#!/usr/bin/env python3
"""Restore the newest encrypted private backup into an isolated database.

The script emits only counts, checksums and status. It never writes a database
dump, decrypted payload, or row contents to a GitHub Actions artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def env(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def request(url: str, key: str, *, method: str = "GET", body: bytes | None = None, headers: dict[str, str] | None = None):
    final = {"apikey": key, "Authorization": f"Bearer {key}", **(headers or {})}
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=final, method=method), timeout=120) as response:
        return response.status, response.read()


def register(url: str, key: str, values: dict) -> None:
    body = json.dumps(values, ensure_ascii=False).encode("utf-8")
    request(f"{url.rstrip('/')}/rest/v1/backup_restore_drills", key, method="POST", body=body, headers={"Content-Type": "application/json", "Prefer": "return=minimal"})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="backup-restore-drill-summary.json")
    args = parser.parse_args()
    supabase_url = env("SUPABASE_URL")
    service_key = env("SUPABASE_SERVICE_KEY")
    restore_db = env("RESTORE_DRILL_DB_URL")
    encryption_key = env("BACKUP_ENCRYPTION_KEY")
    started = datetime.now(timezone.utc)
    summary = {"status": "failed", "environment": "isolated", "started_at": started.isoformat(), "checks": {}}
    if not supabase_url or not service_key or not restore_db or not encryption_key:
        summary["error_code"] = "RESTORE_DRILL_CONFIG_MISSING"
        summary["error_message"] = "SUPABASE_URL, SUPABASE_SERVICE_KEY, RESTORE_DRILL_DB_URL and BACKUP_ENCRYPTION_KEY are required"
    else:
        temp_dir = Path(tempfile.mkdtemp(prefix="jay-restore-drill-"))
        try:
            query = urllib.parse.urlencode({"artifact_kind": "eq.encrypted_backup", "order": "captured_at.desc", "limit": "1", "select": "id,bucket_id,object_path,sha256,byte_size,retention_until"})
            _, raw = request(f"{supabase_url.rstrip('/')}/rest/v1/private_data_artifacts?{query}", service_key)
            artifacts = json.loads(raw.decode("utf-8"))
            if not artifacts:
                raise RuntimeError("NO_ENCRYPTED_BACKUP_FOUND")
            artifact = artifacts[0]
            encrypted = temp_dir / "backup.dump.enc"
            decrypted = temp_dir / "backup.dump"
            bucket = urllib.parse.quote(str(artifact["bucket_id"]), safe="")
            object_path = urllib.parse.quote(str(artifact["object_path"]), safe="/")
            _, payload = request(f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}", service_key)
            encrypted.write_bytes(payload)
            digest = hashlib.sha256(payload).hexdigest()
            summary["checks"]["backup_checksum_matches"] = digest == str(artifact.get("sha256") or "")
            summary["checks"]["backup_size_matches"] = len(payload) == int(artifact.get("byte_size") or -1)
            if not summary["checks"]["backup_checksum_matches"] or not summary["checks"]["backup_size_matches"]:
                raise RuntimeError("BACKUP_INTEGRITY_CHECK_FAILED")
            subprocess.run(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-in", str(encrypted), "-out", str(decrypted), "-pass", "env:BACKUP_ENCRYPTION_KEY"], check=True, env={**os.environ, "BACKUP_ENCRYPTION_KEY": encryption_key}, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            subprocess.run(["pg_restore", "--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", restore_db, str(decrypted)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            checks = [
                ("profiles", "SELECT COUNT(*) FROM public.profiles"),
                ("workspaces", "SELECT COUNT(*) FROM public.workspaces"),
                ("reports", "SELECT COUNT(*) FROM public.generated_reports"),
                ("exports", "SELECT COUNT(*) FROM public.report_exports"),
                ("source_registry", "SELECT COUNT(*) FROM public.data_source_registry"),
            ]
            for name, sql in checks:
                result = subprocess.run(["psql", restore_db, "-Atqc", sql], check=True, capture_output=True, text=True)
                summary["checks"][f"query_{name}"] = result.stdout.strip().isdigit()
            summary["backup_artifact_id"] = artifact.get("id")
            summary["status"] = "passed" if all(value is True for value in summary["checks"].values()) else "failed"
            if summary["status"] != "passed":
                summary["error_code"] = "RESTORE_SMOKE_CHECK_FAILED"
        except Exception as error:
            summary["error_code"] = str(error).split(":", 1)[0][:120]
            summary["error_message"] = str(error)[:240]
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    summary["completed_at"] = datetime.now(timezone.utc).isoformat()
    if supabase_url and service_key:
        try:
            register(supabase_url, service_key, {
                "environment": "isolated", "status": "passed" if summary["status"] == "passed" else "failed",
                "started_at": summary["started_at"], "completed_at": summary["completed_at"],
                "checks": summary.get("checks", {}), "error_code": summary.get("error_code"), "error_message": summary.get("error_message"),
            })
        except Exception:
            summary["registration_status"] = "failed"
    Path(args.output).write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in summary.items() if key not in {"error_message"}}, ensure_ascii=False))
    return 0 if summary["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
