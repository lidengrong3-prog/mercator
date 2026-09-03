"""Validate the source and production-only release configuration.

This is intentionally a fail-closed check. A local feature branch or a dirty
worktree must not be mistaken for the commit that will be published to main.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
ORIGIN_PATTERN = re.compile(r"^https://[^,/?#]+$")
MIGRATION_PATTERN = re.compile(r"^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$")


class ReleasePreflightError(RuntimeError):
    pass


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return result.stdout.strip()


def expected_origin(site_url: str) -> str:
    parsed = urlparse(site_url.strip())
    if parsed.scheme != "https" or not parsed.netloc:
        raise ReleasePreflightError("PRODUCTION_SITE_URL must use an https origin")
    return f"https://{parsed.netloc}"


def validate_origin() -> None:
    configured = os.environ.get("ALLOWED_ORIGINS", "").strip()
    site_url = os.environ.get("PRODUCTION_SITE_URL", "").strip()
    if not configured:
        raise ReleasePreflightError("ALLOWED_ORIGINS is required for production")
    if not site_url:
        raise ReleasePreflightError("PRODUCTION_SITE_URL is required for origin validation")
    origins = [item.strip() for item in configured.split(",") if item.strip()]
    if not origins or any(not ORIGIN_PATTERN.fullmatch(item) for item in origins):
        raise ReleasePreflightError("ALLOWED_ORIGINS must contain only https origins without paths")
    expected = expected_origin(site_url)
    if origins != [expected]:
        raise ReleasePreflightError(
            f"ALLOWED_ORIGINS must contain only the production origin {expected}; got {origins}"
        )


def validate_migrations() -> str:
    files = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
    if not files:
        raise ReleasePreflightError("no Supabase migrations found")
    timestamps: list[str] = []
    for name in files:
        match = MIGRATION_PATTERN.fullmatch(name)
        if not match:
            raise ReleasePreflightError(f"migration filename is not ordered/versioned: {name}")
        timestamps.append(match.group(1))
    if len(set(timestamps)) != len(timestamps):
        raise ReleasePreflightError("migration timestamps must be unique")
    if timestamps != sorted(timestamps):
        raise ReleasePreflightError("migration timestamps are not in ascending order")

    report_migration = MIGRATIONS / "20260826030000_report_exports.sql"
    if not report_migration.exists():
        raise ReleasePreflightError("report Storage migration is missing")
    source = report_migration.read_text(encoding="utf-8")
    if "INSERT INTO storage.buckets" not in source or "report_files_select_own" not in source:
        raise ReleasePreflightError("report Storage bucket or owner policy is missing from migrations")
    return Path(files[-1]).stem


def validate_source() -> str:
    ref = os.environ.get("GITHUB_REF", "").strip()
    if ref:
        if ref != "refs/heads/main":
            raise ReleasePreflightError(f"production release must run from main, not {ref}")
    else:
        branch = git("branch", "--show-current")
        if branch != "main":
            raise ReleasePreflightError(f"production release must run from main, not {branch or 'detached HEAD'}")

    dirty = git("status", "--porcelain")
    if dirty:
        raise ReleasePreflightError("worktree is dirty; commit all release files before publishing")

    head = git("rev-parse", "HEAD")
    github_sha = os.environ.get("GITHUB_SHA", "").strip()
    if github_sha and head != github_sha:
        raise ReleasePreflightError(f"checkout {head} does not match triggering commit {github_sha}")
    return head


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin-only", action="store_true", help="only validate production origin configuration")
    args = parser.parse_args()
    try:
        migration_head = validate_migrations()
        if args.origin_only:
            validate_origin()
            print(f"release preflight passed: origin, migration source ({migration_head})")
        else:
            commit = validate_source()
            if os.environ.get("ALLOWED_ORIGINS") or os.environ.get("PRODUCTION_SITE_URL"):
                validate_origin()
            print(f"release preflight passed: {commit} (migration head {migration_head})")
        return 0
    except (ReleasePreflightError, subprocess.CalledProcessError) as error:
        print(f"[RELEASE PREFLIGHT] FAILED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
