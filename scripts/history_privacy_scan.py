#!/usr/bin/env python3
"""Scan all reachable Git history for restricted paths and high-confidence secrets."""

import argparse
import json
import os
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
    environment = dict(os.environ)
    # Historical scans are offline. Repository completeness is evaluated
    # separately so a partial clone cannot silently lazy-fetch selected blobs.
    environment["GIT_NO_LAZY_FETCH"] = "1"
    return subprocess.run(
        args,
        cwd=root,
        input=input_bytes,
        capture_output=True,
        check=True,
        env=environment,
    ).stdout


def _optional_run(root, args):
    try:
        return _run(root, args).decode("utf-8", errors="replace").strip()
    except subprocess.CalledProcessError:
        return ""


def _batch_blob_contents(root, blobs):
    request = "".join(object_id + "\n" for object_id, _ in blobs).encode("ascii")
    raw = _run(root, ["git", "cat-file", "--batch"], input_bytes=request)
    offset = 0
    for expected_id, expected_size in blobs:
        line_end = raw.find(b"\n", offset)
        if line_end < 0:
            raise ValueError(f"missing cat-file header for {expected_id}")
        header = raw[offset:line_end].decode("ascii", errors="replace").split()
        if len(header) != 3 or header[0] != expected_id or header[1] != "blob":
            raise ValueError(f"unexpected cat-file header for {expected_id}")
        size = int(header[2])
        if size != expected_size:
            raise ValueError(f"blob size mismatch for {expected_id}")
        content_start = line_end + 1
        content_end = content_start + size
        if content_end >= len(raw) or raw[content_end:content_end + 1] != b"\n":
            raise ValueError(f"truncated cat-file content for {expected_id}")
        yield expected_id, raw[content_start:content_end]
        offset = content_end + 1
    if offset != len(raw):
        raise ValueError("unexpected trailing cat-file output")


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
    if path.parts and path.parts[0].casefold() == "reports" and path.suffix.casefold() == ".pdf":
        return "legacy generated PDF"
    return None


def scan_history(root):
    root = str(root)
    shallow = _optional_run(root, ["git", "rev-parse", "--is-shallow-repository"]) == "true"
    partial = bool(_optional_run(root, ["git", "config", "--get", "extensions.partialclone"]))
    if not partial:
        partial = bool(_optional_run(root, ["git", "config", "--get-regexp", r"^remote\..*\.promisor$"]))
    path_lines = _run(root, ["git", "log", "--all", "--name-only", "--format=", "--no-renames"])
    historical_paths = sorted({line.strip() for line in path_lines.decode("utf-8", errors="replace").splitlines() if line.strip()})
    restricted_paths = [
        {"path": path, "reason": reason}
        for path in historical_paths
        if (reason := _restricted_path_reason(path))
    ]
    secret_findings = []
    scan_errors = []
    object_paths = {}
    blob_count = 0
    blob_bytes = 0
    scanned_blob_count = 0
    scanned_blob_bytes = 0
    try:
        object_lines = _run(root, ["git", "rev-list", "--objects", "--all"])
        object_ids = []
        for raw_line in object_lines.decode("utf-8", errors="replace").splitlines():
            object_id, _, path = raw_line.partition(" ")
            if not object_id:
                continue
            object_ids.append(object_id)
            if path:
                object_paths.setdefault(object_id, set()).add(path)
        batch_input = "".join(object_id + "\n" for object_id in object_ids).encode("ascii")
        object_meta = _run(
            root,
            ["git", "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
            input_bytes=batch_input,
        )
        blobs = []
        for raw_line in object_meta.decode("ascii", errors="replace").splitlines():
            fields = raw_line.split()
            if len(fields) != 3 or fields[1] != "blob":
                continue
            object_id, _, size_text = fields
            size = int(size_text)
            blobs.append((object_id, size))
            blob_count += 1
            blob_bytes += size
        for object_id, content in _batch_blob_contents(root, blobs):
            scanned_blob_count += 1
            scanned_blob_bytes += len(content)
            text = content.decode("utf-8", errors="ignore")
            for label, pattern in SECRET_PATTERNS:
                if not pattern.search(text):
                    continue
                commits = _optional_run(root, [
                    "git", "log", "--all", "--no-textconv", "--format=%H",
                    "--find-object=" + object_id,
                ]).splitlines()
                paths = sorted(object_paths.get(object_id) or {"(path unavailable)"})
                for path in paths:
                    secret_findings.append({
                        "path": path,
                        "commit": commits[0] if commits else None,
                        "blob": object_id,
                        "kind": label,
                    })
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        scan_errors.append({"kind": "reachable blob content scan", "reason": str(error)})

    # Pickaxe is a second, independent path-to-commit cross-check. Disable
    # textconv so historical PDF attributes cannot break the scan.
    fixed_signatures = {label: signature for label, signature in (
        ("private key", "BEGIN "), ("GitHub token", "ghp_"),
        ("GitHub fine-grained token", "github_pat_"), ("AWS access key", "AKIA"),
        ("Stripe live key", "sk_live_"), ("Resend API key", "re_"),
        ("provider API key", "sk-"), ("Slack token", "xox"),
    )}
    pickaxe_patterns_scanned = 0
    for label, signature in fixed_signatures.items():
        try:
            _run(root, [
                "git", "log", "--all", "--format=%H", "--name-only",
                "--no-renames", "--no-textconv", "-S", signature,
            ])
        except subprocess.CalledProcessError as error:
            scan_errors.append({"kind": label, "reason": f"pickaxe scan failed: {error}"})
            continue
        pickaxe_patterns_scanned += 1
    complete = not shallow and not partial and not scan_errors and scanned_blob_count == blob_count
    return {
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "repository_complete": not shallow and not partial,
        "shallow_repository": shallow,
        "partial_clone": partial,
        "historical_path_count": len(historical_paths),
        "reachable_blob_count": blob_count,
        "reachable_blob_bytes": blob_bytes,
        "scanned_blob_count": scanned_blob_count,
        "scanned_blob_bytes": scanned_blob_bytes,
        "scanned_secret_pattern_count": len(SECRET_PATTERNS),
        "pickaxe_pattern_count": pickaxe_patterns_scanned,
        "secret_scan_complete": complete,
        "scan_errors": scan_errors,
        "restricted_paths": sorted({(item["path"], item["reason"]): item for item in restricted_paths}.values(), key=lambda item: item["path"]),
        "secret_findings": sorted(
            {(item["path"], item.get("commit"), item["kind"], item.get("blob")): item for item in secret_findings}.values(),
            key=lambda item: (item["path"], item.get("commit") or "", item["kind"]),
        ),
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
        "repository_complete": result["repository_complete"],
        "reachable_blob_count": result["reachable_blob_count"],
        "scanned_blob_count": result["scanned_blob_count"],
        "scanned_secret_pattern_count": result["scanned_secret_pattern_count"],
        "pickaxe_pattern_count": result["pickaxe_pattern_count"],
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
