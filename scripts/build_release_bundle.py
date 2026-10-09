#!/usr/bin/env python3
"""Write the immutable R11 release contract into a built static site."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse


CRITICAL_ASSETS = (
    "assets/runtime-config.js",
    "assets/app-shell.css",
    "assets/js/auth-data.js",
    "assets/js/product-enhancements.js",
    "assets/js/products-shops.js",
    "assets/js/report-engine.js",
    "assets/js/reports-decisions.js",
)


class ReleaseBundleError(RuntimeError):
    pass


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def read_json(path: Path, description: str):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ReleaseBundleError(f"invalid {description}: {error}") from error


def resource_record(site: Path, relative_path: str) -> dict:
    pure = PurePosixPath(relative_path)
    if pure.is_absolute() or ".." in pure.parts:
        raise ReleaseBundleError(f"unsafe release resource path: {relative_path}")
    path = site.joinpath(*pure.parts)
    if not path.is_file():
        raise ReleaseBundleError(f"release resource is missing: {relative_path}")
    payload = path.read_bytes()
    return {"sha256": sha256(payload), "bytes": len(payload)}


def build_release_bundle(
    site: Path,
    *,
    release_sha: str,
    migration_head: str,
    production_origin: str,
    source_ref: str,
) -> dict:
    site = Path(site).resolve()
    if not site.is_dir():
        raise ReleaseBundleError(f"built site does not exist: {site}")
    if not release_sha or not migration_head:
        raise ReleaseBundleError("release SHA and migration head are required")
    parsed = urlparse(production_origin)
    if parsed.scheme != "https" or not parsed.netloc or parsed.path not in {"", "/"}:
        raise ReleaseBundleError("production origin must be an HTTPS origin")
    production_origin = f"https://{parsed.netloc}"

    asset_manifest_path = site / "asset-manifest.json"
    asset_manifest = read_json(asset_manifest_path, "asset manifest")
    if not isinstance(asset_manifest, dict) or not asset_manifest:
        raise ReleaseBundleError("asset manifest must be a non-empty object")

    critical_paths = []
    for logical in CRITICAL_ASSETS:
        deployed = asset_manifest.get(logical)
        if not deployed:
            raise ReleaseBundleError(f"critical asset is absent from the manifest: {logical}")
        critical_paths.append(str(deployed))

    rules_source = read_json(site / "edgeone-rules-source.json", "EdgeOne rules source")
    if (rules_source.get("authority") != "repository-build-artifact"
            or rules_source.get("manual_overrides_allowed") is not False):
        raise ReleaseBundleError("EdgeOne rules source is not repository-owned")

    generated_at = datetime.now(timezone.utc).isoformat()
    release = {
        "schema_version": 2,
        "release_sha": release_sha,
        "migration_head": migration_head,
        "production_origin": production_origin,
        "frontend": "github-pages+edgeone-pages",
        "source_ref": source_ref,
        "generated_at": generated_at,
        "asset_manifest_sha256": sha256(asset_manifest_path.read_bytes()),
        "edgeone_rules_sha256": sha256((site / "edgeone.json").read_bytes()),
        "release_integrity_path": "release-integrity.json",
    }
    release_path = site / "release.json"
    release_path.write_text(
        json.dumps(release, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    resource_paths = (
        "index.html",
        "release.json",
        "asset-manifest.json",
        "public-data-manifest.json",
        "edgeone.json",
        "edgeone-rules-source.json",
        "middleware.js",
        *critical_paths,
    )
    resources = {
        path: resource_record(site, path)
        for path in dict.fromkeys(resource_paths)
    }
    integrity = {
        "schema_version": 1,
        "release_sha": release_sha,
        "migration_head": migration_head,
        "production_origin": production_origin,
        "generated_at": generated_at,
        "asset_manifest_sha256": release["asset_manifest_sha256"],
        "edgeone_rules": {
            "authority": "repository-build-artifact",
            "manual_overrides_allowed": False,
            "rules_sha256": release["edgeone_rules_sha256"],
            "source_manifest": "edgeone-rules-source.json",
            "source_header": "X-JAY-EdgeOne-Rules-Source",
            "source_header_value": "repository-build-artifact",
        },
        "resources": resources,
    }
    (site / "release-integrity.json").write_text(
        json.dumps(integrity, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return integrity


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", required=True)
    parser.add_argument("--release-sha", required=True)
    parser.add_argument("--migration-head", required=True)
    parser.add_argument("--production-origin", required=True)
    parser.add_argument("--source-ref", default="main")
    args = parser.parse_args()
    result = build_release_bundle(
        Path(args.site),
        release_sha=args.release_sha.strip(),
        migration_head=args.migration_head.strip(),
        production_origin=args.production_origin.strip(),
        source_ref=args.source_ref.strip(),
    )
    print(json.dumps({
        "status": "passed",
        "release_sha": result["release_sha"],
        "resource_count": len(result["resources"]),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ReleaseBundleError as error:
        raise SystemExit(f"[R11 RELEASE BUNDLE] FAILED: {error}")
