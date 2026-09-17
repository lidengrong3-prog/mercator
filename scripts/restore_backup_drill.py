#!/usr/bin/env python3
"""Restore encrypted backups into an explicitly isolated database target."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


CHUNK_SIZE = 1024 * 1024
RLS_TABLES = (
    "profiles",
    "workspaces",
    "generated_reports",
    "report_exports",
    "data_source_registry",
)


def env(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def request(
    url: str,
    key: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
):
    final = {"apikey": key, "Authorization": f"Bearer {key}", **(headers or {})}
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, data=body, headers=final, method=method),
            timeout=180,
        ) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"RESTORE_API_HTTP_{error.code}") from None
    except (OSError, TimeoutError) as error:
        raise RuntimeError("RESTORE_API_UNAVAILABLE") from error


def register(url: str, key: str, values: dict) -> None:
    body = json.dumps(values, ensure_ascii=False).encode("utf-8")
    status, _ = request(
        f"{url.rstrip('/')}/rest/v1/backup_restore_drills",
        key,
        method="POST",
        body=body,
        headers={"Content-Type": "application/json", "Prefer": "return=minimal"},
    )
    if status not in (200, 201):
        raise RuntimeError(f"RESTORE_DRILL_REGISTER_HTTP_{status}")


def database_project_refs(database_url: str) -> set[str]:
    parsed = urllib.parse.urlparse(database_url)
    refs: set[str] = set()
    username = urllib.parse.unquote(parsed.username or "")
    if "." in username:
        candidate = username.rsplit(".", 1)[-1].lower()
        if re.fullmatch(r"[a-z0-9]{20}", candidate):
            refs.add(candidate)
    host = (parsed.hostname or "").lower()
    match = re.fullmatch(r"db\.([a-z0-9]{20})\.supabase\.co", host)
    if match:
        refs.add(match.group(1))
    return refs


def database_endpoint(database_url: str) -> tuple[str, int, str]:
    parsed = urllib.parse.urlparse(database_url)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname or not parsed.path.strip("/"):
        raise RuntimeError("RESTORE_DATABASE_URL_INVALID")
    return parsed.hostname.lower(), parsed.port or 5432, parsed.path.strip("/").lower()


def validate_isolated_target(restore_url: str, production_url: str, confirmation: str) -> None:
    if confirmation.lower() != "true":
        raise RuntimeError("RESTORE_DRILL_ISOLATION_NOT_CONFIRMED")
    restore_endpoint = database_endpoint(restore_url)
    production_endpoint = database_endpoint(production_url)
    if restore_endpoint == production_endpoint:
        raise RuntimeError("RESTORE_DRILL_TARGET_MATCHES_PRODUCTION")
    restore_refs = database_project_refs(restore_url)
    production_refs = database_project_refs(production_url)
    if restore_refs and production_refs and restore_refs.intersection(production_refs):
        raise RuntimeError("RESTORE_DRILL_TARGET_MATCHES_PRODUCTION_PROJECT")


def latest_artifact(url: str, key: str, artifact_kind: str) -> dict:
    query = urllib.parse.urlencode({
        "artifact_kind": f"eq.{artifact_kind}",
        "retention_until": f"gt.{datetime.now(timezone.utc).isoformat()}",
        "order": "captured_at.desc",
        "limit": "1",
        "select": "id,bucket_id,object_path,sha256,byte_size,retention_until,captured_at",
    })
    _, raw = request(f"{url.rstrip('/')}/rest/v1/private_data_artifacts?{query}", key)
    try:
        artifacts = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("RESTORE_ARTIFACT_REGISTRY_INVALID") from error
    if not isinstance(artifacts, list) or not artifacts:
        raise RuntimeError(f"NO_{artifact_kind.upper()}_FOUND")
    return artifacts[0]


def download_artifact(url: str, key: str, artifact: dict, destination: Path) -> None:
    bucket = urllib.parse.quote(str(artifact["bucket_id"]), safe="")
    object_path = urllib.parse.quote(str(artifact["object_path"]), safe="/")
    _, payload = request(f"{url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}", key)
    digest = hashlib.sha256(payload).hexdigest()
    if digest != str(artifact.get("sha256") or ""):
        raise RuntimeError("BACKUP_CHECKSUM_MISMATCH")
    if len(payload) != int(artifact.get("byte_size") or -1):
        raise RuntimeError("BACKUP_SIZE_MISMATCH")
    destination.write_bytes(payload)


def run_checked(command: list[str], *, environment: dict | None = None, error_code: str) -> None:
    result = subprocess.run(
        command,
        env=environment,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(error_code)


def psql_value(database_url: str, sql: str) -> str:
    result = subprocess.run(
        ["psql", database_url, "-Atqc", sql],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("RESTORE_DATABASE_QUERY_FAILED")
    return result.stdout.strip()


def verify_storage_archive(archive_path: Path) -> dict:
    try:
        with tarfile.open(archive_path, "r:gz") as archive:
            members = {member.name: member for member in archive.getmembers()}
            for member in members.values():
                posix = PurePosixPath(member.name)
                if posix.is_absolute() or ".." in posix.parts or member.issym() or member.islnk() or member.isdev():
                    raise RuntimeError("STORAGE_ARCHIVE_UNSAFE_MEMBER")
            manifest_member = members.get("manifest.json")
            if not manifest_member or manifest_member.size > 10 * 1024 * 1024:
                raise RuntimeError("STORAGE_ARCHIVE_MANIFEST_MISSING")
            manifest_file = archive.extractfile(manifest_member)
            if manifest_file is None:
                raise RuntimeError("STORAGE_ARCHIVE_MANIFEST_MISSING")
            manifest = json.loads(manifest_file.read().decode("utf-8"))
            total_objects = 0
            total_bytes = 0
            for bucket, bucket_data in (manifest.get("buckets") or {}).items():
                entries = bucket_data.get("entries") if isinstance(bucket_data, dict) else None
                if not isinstance(entries, list):
                    raise RuntimeError("STORAGE_ARCHIVE_MANIFEST_INVALID")
                for entry in entries:
                    path = str(entry.get("path") or "")
                    member = members.get(f"{bucket}/{path}")
                    if not member or not member.isfile() or member.size != int(entry.get("size_bytes") or -1):
                        raise RuntimeError("STORAGE_ARCHIVE_OBJECT_MISMATCH")
                    payload = archive.extractfile(member)
                    if payload is None:
                        raise RuntimeError("STORAGE_ARCHIVE_OBJECT_MISMATCH")
                    digest = hashlib.sha256()
                    for chunk in iter(lambda: payload.read(CHUNK_SIZE), b""):
                        digest.update(chunk)
                    if digest.hexdigest() != str(entry.get("sha256") or ""):
                        raise RuntimeError("STORAGE_ARCHIVE_OBJECT_MISMATCH")
                    total_objects += 1
                    total_bytes += member.size
            if total_objects != int(manifest.get("total_objects") or 0):
                raise RuntimeError("STORAGE_ARCHIVE_COUNT_MISMATCH")
            if total_bytes != int(manifest.get("total_bytes") or 0):
                raise RuntimeError("STORAGE_ARCHIVE_SIZE_MISMATCH")
            return {
                "objects": total_objects,
                "bytes": total_bytes,
                "buckets": len(manifest.get("buckets") or {}),
            }
    except (tarfile.TarError, OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("STORAGE_ARCHIVE_INVALID") from error


def restore_database(database_url: str, encrypted: Path, decrypted: Path, encryption_key: str) -> dict:
    command_env = {**os.environ, "BACKUP_ENCRYPTION_KEY": encryption_key}
    run_checked([
        "openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
        "-in", str(encrypted), "-out", str(decrypted),
        "-pass", "env:BACKUP_ENCRYPTION_KEY",
    ], environment=command_env, error_code="DATABASE_BACKUP_DECRYPT_FAILED")
    run_checked([
        "pg_restore", "--clean", "--if-exists", "--no-owner", "--no-privileges",
        "--dbname", database_url, str(decrypted),
    ], error_code="DATABASE_RESTORE_FAILED")
    row_counts = {}
    queries = {
        "profiles": "SELECT COUNT(*) FROM public.profiles",
        "workspaces": "SELECT COUNT(*) FROM public.workspaces",
        "reports": "SELECT COUNT(*) FROM public.generated_reports",
        "exports": "SELECT COUNT(*) FROM public.report_exports",
        "source_registry": "SELECT COUNT(*) FROM public.data_source_registry",
    }
    for name, sql in queries.items():
        value = psql_value(database_url, sql)
        if not value.isdigit():
            raise RuntimeError("RESTORE_SMOKE_CHECK_FAILED")
        row_counts[name] = int(value)
    migration_count = psql_value(
        database_url,
        "SELECT COUNT(*) FROM supabase_migrations.schema_migrations",
    )
    migration_head = psql_value(
        database_url,
        "SELECT COALESCE(MAX(version), '') FROM supabase_migrations.schema_migrations",
    )
    if not migration_count.isdigit() or int(migration_count) < 1 or not migration_head:
        raise RuntimeError("RESTORE_MIGRATION_LEDGER_INVALID")
    table_list = ",".join(f"'{table}'" for table in RLS_TABLES)
    rls_value = psql_value(
        database_url,
        "SELECT COUNT(*) FILTER (WHERE c.relrowsecurity)::text || ',' || COUNT(*)::text "
        "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
        f"WHERE n.nspname='public' AND c.relname IN ({table_list})",
    )
    try:
        rls_enabled, rls_total = (int(part) for part in rls_value.split(",", 1))
    except (TypeError, ValueError) as error:
        raise RuntimeError("RESTORE_RLS_CHECK_INVALID") from error
    if rls_enabled != len(RLS_TABLES) or rls_total != len(RLS_TABLES):
        raise RuntimeError("RESTORE_RLS_CHECK_FAILED")
    return {
        "row_counts": row_counts,
        "migration_count": int(migration_count),
        "migration_head": migration_head,
        "rls_tables_enabled": rls_enabled,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="backup-restore-drill-summary.json")
    args = parser.parse_args(argv)
    output_path = Path(args.output)
    supabase_url = env("SUPABASE_URL")
    service_key = env("SUPABASE_SERVICE_KEY")
    restore_db = env("RESTORE_DRILL_DB_URL")
    production_db = env("PRODUCTION_DB_URL") or env("SUPABASE_DB_URL")
    encryption_key = env("BACKUP_ENCRYPTION_KEY")
    confirmation = env("RESTORE_DRILL_CONFIRM_ISOLATED")
    started = datetime.now(timezone.utc)
    summary: dict = {
        "status": "failed",
        "environment": "isolated",
        "started_at": started.isoformat(),
        "checks": {},
        "metrics": {},
    }
    required = {
        "SUPABASE_URL": supabase_url,
        "SUPABASE_SERVICE_KEY": service_key,
        "RESTORE_DRILL_DB_URL": restore_db,
        "PRODUCTION_DB_URL": production_db,
        "BACKUP_ENCRYPTION_KEY": encryption_key,
    }
    missing = [name for name, value in required.items() if not value]
    database_artifact = None
    storage_artifact = None
    if missing:
        summary["error_code"] = "RESTORE_DRILL_CONFIG_MISSING"
        summary["missing_config"] = missing
    else:
        temp_dir = Path(tempfile.mkdtemp(prefix="jay-restore-drill-"))
        try:
            validate_isolated_target(restore_db, production_db, confirmation)
            summary["checks"]["isolated_target_confirmed"] = True
            psql_value(restore_db, "SELECT current_database()")
            summary["checks"]["isolated_target_reachable"] = True

            database_artifact = latest_artifact(supabase_url, service_key, "encrypted_backup")
            database_encrypted = temp_dir / "database.dump.enc"
            database_decrypted = temp_dir / "database.dump"
            download_artifact(supabase_url, service_key, database_artifact, database_encrypted)
            summary["checks"]["database_backup_integrity"] = True
            database_metrics = restore_database(
                restore_db,
                database_encrypted,
                database_decrypted,
                encryption_key,
            )
            summary["checks"]["database_restored"] = True
            summary["checks"]["migration_ledger_valid"] = database_metrics["migration_count"] > 0
            summary["checks"]["rls_enabled"] = database_metrics["rls_tables_enabled"] == len(RLS_TABLES)
            summary["metrics"]["database"] = database_metrics

            storage_artifact = latest_artifact(supabase_url, service_key, "storage_backup")
            storage_encrypted = temp_dir / "storage.tar.gz.enc"
            storage_archive = temp_dir / "storage.tar.gz"
            download_artifact(supabase_url, service_key, storage_artifact, storage_encrypted)
            summary["checks"]["storage_backup_integrity"] = True
            run_checked([
                "openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
                "-in", str(storage_encrypted), "-out", str(storage_archive),
                "-pass", "env:BACKUP_ENCRYPTION_KEY",
            ], environment={**os.environ, "BACKUP_ENCRYPTION_KEY": encryption_key}, error_code="STORAGE_BACKUP_DECRYPT_FAILED")
            storage_metrics = verify_storage_archive(storage_archive)
            summary["checks"]["storage_archive_verified"] = True
            summary["metrics"]["storage"] = storage_metrics
            summary["database_backup_artifact_id"] = database_artifact.get("id")
            summary["storage_backup_artifact_id"] = storage_artifact.get("id")
            summary["status"] = "passed"
        except Exception as error:  # noqa: BLE001 - never expose commands or database URLs.
            summary["error_code"] = str(error).split(":", 1)[0][:120] or "RESTORE_DRILL_FAILED"
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    summary["completed_at"] = datetime.now(timezone.utc).isoformat()
    if supabase_url and service_key:
        try:
            register(supabase_url, service_key, {
                "backup_artifact_id": database_artifact.get("id") if database_artifact else None,
                "environment": "isolated",
                "status": "passed" if summary["status"] == "passed" else "failed",
                "started_at": summary["started_at"],
                "completed_at": summary["completed_at"],
                "checks": summary.get("checks", {}),
                "error_code": summary.get("error_code"),
                "error_message": summary.get("error_code"),
            })
            summary["registration_status"] = "completed"
        except Exception:
            summary["registration_status"] = "failed"
            summary["status"] = "failed"
            summary["error_code"] = "RESTORE_DRILL_REGISTRATION_FAILED"
    output_path.write_text(json.dumps(summary, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if summary["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
