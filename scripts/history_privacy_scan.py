#!/usr/bin/env python3
"""Scan all reachable Git history for restricted paths and high-confidence secrets."""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import PurePosixPath

from repository_privacy_check import (
    RESTRICTED_COMPONENTS,
    RESTRICTED_EXACT,
    SECRET_PATTERNS,
    US_MARKET_PRIVATE,
)


def _run(root, args, *, input_bytes=None):
    environment = dict(__import__("os").environ)
    # This repository is a partial clone. Historical scans must be offline and
    # must never trigger a promisor fetch of old blobs.
    environment["GIT_NO_LAZY_FETCH"] = "1"
    return subprocess.run(
        args,
        cwd=root,
        input=input_bytes,
        capture_output=True,
        check=True,
        env=environment,
    ).stdout


def _restricted_path_reason(relative):
    path = PurePosixPath(relative)
    lowered = relative.casefold()
    parts = {part.casefold() for part in path.parts}
    if lowered in RESTRICTED_EXACT:
        return "restricted data path"
    if parts & RESTRICTED_COMPONENTS:
        return "restricted directory"
    if len(path.parts) == 3 and path.parts[:2] == ("data", "us_market") and path.name in US_MARKET_PRIVATE:
        return "private US category dataset"
    return None


def scan_history(root):
    root = str(root)
    path_lines = _run(root, ["git", "log", "--all", "--name-only", "--format=", "--no-renames"])
    historical_paths = sorted({line.strip() for line in path_lines.decode("utf-8", errors="replace").splitlines() if line.strip()})
    restricted_paths = [
        {"path": path, "reason": reason}
        for path in historical_paths
        if (reason := _restricted_path_reason(path))
    ]
    secret_findings = []
    scanned_patterns = 0
    scan_errors = []
    fixed_signatures = {
        "private key": "BEGIN ",
        "GitHub token": "ghp_",
        "GitHub fine-grained token": "github_pat_",
        "AWS access key": "AKIA",
        "Stripe live key": "sk_live_",
        "Resend API key": "re_",
        "provider API key": "sk-",
        "Slack token": "xox",
    }
    for label, signature in fixed_signatures.items():
        try:
            raw = _run(root, [
                "git", "log", "--all", "--format=%H", "--name-only",
                "--no-renames", "-S", signature,
            ])
        except subprocess.CalledProcessError:
            scan_errors.append({"kind": label, "reason": "Git object unavailable in partial clone"})
            continue
        scanned_patterns += 1
        commit = None
        for line in raw.decode("utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line:
                continue
            if len(line) == 40 and all(char in "0123456789abcdef" for char in line.casefold()):
                commit = line
            elif commit:
                secret_findings.append({"path": line, "commit": commit, "kind": label})
    return {
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "historical_path_count": len(historical_paths),
        "scanned_secret_pattern_count": scanned_patterns,
        "secret_scan_complete": not scan_errors,
        "scan_errors": scan_errors,
        "restricted_paths": sorted({(item["path"], item["reason"]): item for item in restricted_paths}.values(), key=lambda item: item["path"]),
        "secret_findings": sorted({(item["path"], item["commit"], item["kind"]): item for item in secret_findings}.values(), key=lambda item: (item["path"], item["commit"])),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--fail-on-secrets", action="store_true")
    args = parser.parse_args()
    result = scan_history(args.root)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps({
        "historical_path_count": result["historical_path_count"],
        "scanned_secret_pattern_count": result["scanned_secret_pattern_count"],
        "restricted_path_count": len(result["restricted_paths"]),
        "secret_finding_count": len(result["secret_findings"]),
        "secret_scan_complete": result["secret_scan_complete"],
        "scan_error_count": len(result["scan_errors"]),
    }, ensure_ascii=False))
    if args.fail_on_secrets and result["secret_findings"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
