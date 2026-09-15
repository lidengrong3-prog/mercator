#!/usr/bin/env python3
"""Restore a new Worker's private state from service-only Supabase artifacts."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Mapping

from sync_to_supabase import PRIVATE_ARTIFACT_SPECS


ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = (ROOT / "data").resolve()
MARKER = DATA_ROOT / ".worker-state-initialized.json"
SSL_CONTEXT = ssl.create_default_context()
MAX_ARTIFACT_BYTES = 64 * 1024 * 1024
REQUIRED_STATE_PATHS = (
    "data/countries.json",
    "data/platforms.json",
    "data/policies.json",
    "data/rules.json",
    "data/us_market/macro_indicators.json",
)
PRIVATE_PROJECTION_FALLBACKS = {
    "data/countries.json": "data/private_repository_source/countries.json",
    "data/platforms.json": "data/private_repository_source/platforms.json",
    "data/policies.json": "data/private_repository_source/policies.json",
    "data/rules.json": "data/private_repository_source/rules.json",
    "data/us_market/macro_indicators.json":
        "data/private_repository_source/us_market/macro_indicators.json",
}


class WorkerBootstrapError(RuntimeError):
    """The persistent Worker state could not be restored safely."""


def _normalized_relative_path(value: Any) -> str | None:
    text = str(value or "").strip().replace("\\", "/")
    path = PurePosixPath(text)
    if not text or path.is_absolute() or ".." in path.parts or not text.startswith("data/"):
        return None
    normalized = path.as_posix()
    def matches(pattern: str) -> bool:
        if pattern.endswith("/**/*") and normalized.startswith(pattern[:-4]):
            return True
        return fnmatch.fnmatchcase(normalized, pattern)

    allowed = any(matches(pattern) for pattern, *_ in PRIVATE_ARTIFACT_SPECS)
    return normalized if allowed else None


def latest_artifacts_by_path(rows: Iterable[Mapping[str, Any]]) -> dict[str, dict[str, Any]]:
    """Choose the newest allowlisted artifact per repository-relative path."""
    latest: dict[str, dict[str, Any]] = {}
    ordered = sorted(
        (dict(row) for row in rows if isinstance(row, Mapping)),
        key=lambda row: str(row.get("captured_at") or ""),
        reverse=True,
    )
    for row in ordered:
        metadata = row.get("metadata") if isinstance(row.get("metadata"), Mapping) else {}
        relative_path = _normalized_relative_path(metadata.get("repository_relative_path"))
        if relative_path and relative_path not in latest:
            latest[relative_path] = row
    return latest


def restore_plan(rows: Iterable[Mapping[str, Any]]) -> list[tuple[dict[str, Any], tuple[str, ...]]]:
    latest = latest_artifacts_by_path(rows)
    targets_by_object: dict[tuple[str, str], dict[str, Any]] = {}

    def add(row: Mapping[str, Any], target: str) -> None:
        key = (str(row.get("bucket_id") or ""), str(row.get("object_path") or ""))
        if not all(key):
            return
        entry = targets_by_object.setdefault(key, {"row": dict(row), "targets": []})
        if target not in entry["targets"]:
            entry["targets"].append(target)

    for relative_path, row in latest.items():
        add(row, relative_path)
    for required_path, fallback_path in PRIVATE_PROJECTION_FALLBACKS.items():
        row = latest.get(required_path) or latest.get(fallback_path)
        if row:
            add(row, required_path)

    return [
        (entry["row"], tuple(entry["targets"]))
        for entry in targets_by_object.values()
    ]


def _request(url: str, key: str, *, timeout: int = 120) -> bytes:
    request = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
            payload = response.read(MAX_ARTIFACT_BYTES + 1)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:300]
        raise WorkerBootstrapError(f"private artifact request failed: HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise WorkerBootstrapError(f"private artifact request failed: {error.reason}") from error
    if len(payload) > MAX_ARTIFACT_BYTES:
        raise WorkerBootstrapError("private artifact exceeds the 64 MiB restore limit")
    return payload


def list_artifacts(supabase_url: str, service_key: str, *, limit: int = 2000) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({
        "select": "bucket_id,object_path,sha256,byte_size,captured_at,retention_until,metadata",
        "retention_until": f"gt.{datetime.now(timezone.utc).isoformat()}",
        "order": "captured_at.desc",
        "limit": str(max(1, min(limit, 5000))),
    })
    payload = _request(f"{supabase_url.rstrip('/')}/rest/v1/private_data_artifacts?{query}", service_key)
    try:
        rows = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise WorkerBootstrapError("private artifact registry returned invalid JSON") from error
    if not isinstance(rows, list):
        raise WorkerBootstrapError("private artifact registry returned an invalid response")
    return [row for row in rows if isinstance(row, dict)]


def download_artifact(supabase_url: str, service_key: str, row: Mapping[str, Any]) -> bytes:
    bucket = urllib.parse.quote(str(row.get("bucket_id") or ""), safe="")
    object_path = urllib.parse.quote(str(row.get("object_path") or ""), safe="/")
    if not bucket or not object_path:
        raise WorkerBootstrapError("private artifact is missing its Storage location")
    payload = _request(f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}", service_key)
    expected_size = int(row.get("byte_size") or -1)
    expected_hash = str(row.get("sha256") or "").lower()
    if len(payload) != expected_size or hashlib.sha256(payload).hexdigest() != expected_hash:
        metadata = row.get("metadata") if isinstance(row.get("metadata"), Mapping) else {}
        relative_path = _normalized_relative_path(metadata.get("repository_relative_path")) or "unknown"
        raise WorkerBootstrapError(
            f"private artifact checksum or byte size does not match its registry: {relative_path}"
        )
    return payload


def download_with_retry(
    supabase_url: str,
    service_key: str,
    row: Mapping[str, Any],
    *,
    attempts: int = 3,
    sleep_fn=time.sleep,
) -> bytes:
    last_error: WorkerBootstrapError | None = None
    for attempt in range(1, max(1, attempts) + 1):
        try:
            return download_artifact(supabase_url, service_key, row)
        except WorkerBootstrapError as error:
            last_error = error
            if attempt >= attempts:
                raise
            sleep_fn(attempt)
    raise last_error or WorkerBootstrapError("private artifact restore failed")


def _target_path(relative_path: str) -> Path:
    normalized = _normalized_relative_path(relative_path)
    if not normalized:
        raise WorkerBootstrapError(f"restore target is not allowlisted: {relative_path}")
    target = (ROOT / normalized).resolve()
    if target != DATA_ROOT and DATA_ROOT not in target.parents:
        raise WorkerBootstrapError("restore target escaped the Worker data directory")
    return target


def _atomic_write(target: Path, payload: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.worker-restore.tmp")
    temporary.write_bytes(payload)
    os.replace(temporary, target)


def _required_state_valid() -> bool:
    for relative_path in REQUIRED_STATE_PATHS:
        path = ROOT / relative_path
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return False
        if not isinstance(value, (dict, list)):
            return False
    return True


def bootstrap(supabase_url: str, service_key: str, *, required: bool = False) -> dict[str, Any]:
    if MARKER.exists() and _required_state_valid():
        return {"status": "already_initialized", "restored_artifacts": 0, "restored_paths": 0}

    rows = list_artifacts(supabase_url, service_key)
    plan = restore_plan(rows)
    restored_targets: set[str] = set()
    for row, targets in plan:
        payload = download_with_retry(supabase_url, service_key, row)
        for relative_path in targets:
            _atomic_write(_target_path(relative_path), payload)
            restored_targets.add(relative_path)

    missing = [path for path in REQUIRED_STATE_PATHS if path not in restored_targets]
    if required and missing:
        raise WorkerBootstrapError(
            "private Worker bootstrap is missing required artifacts: " + ", ".join(missing)
        )
    if required and not _required_state_valid():
        raise WorkerBootstrapError("restored Worker state failed JSON validation")

    marker = {
        "schema_version": 1,
        "initialized_at": datetime.now(timezone.utc).isoformat(),
        "restored_artifacts": len(plan),
        "restored_paths": len(restored_targets),
    }
    _atomic_write(MARKER, (json.dumps(marker, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    return {"status": "restored", **marker}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--required", action="store_true", help="Fail if the five complete state datasets cannot be restored")
    args = parser.parse_args()
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not supabase_url or not service_key:
        print("[WORKER BOOTSTRAP] SUPABASE_URL and SUPABASE_SERVICE_KEY are required", file=sys.stderr)
        return 2
    try:
        result = bootstrap(supabase_url, service_key, required=args.required)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (WorkerBootstrapError, OSError, ValueError) as error:
        print(f"[WORKER BOOTSTRAP] {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
