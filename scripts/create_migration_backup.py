#!/usr/bin/env python3
"""Create and verify an encrypted logical backup before a production migration.

Only the encrypted payload is uploaded to the private Storage bucket. The
summary contains the migration anchor, checksum, archive checks and rollback
instructions, but never a connection string, key, row value or dump content.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"


def env(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def migration_versions() -> list[str]:
    return [path.stem.split("_", 1)[0] for path in sorted(MIGRATIONS.glob("*.sql"))]


def run_command(args: list[str], *, environment: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=True,
        capture_output=True,
        text=True,
        env=environment,
    )


def validate_database_url(db_url: str) -> None:
    """Reject malformed connection strings without ever echoing their contents."""
    if "YOUR-PASSWORD" in db_url.upper():
        raise RuntimeError("DATABASE_URL_CONTAINS_PLACEHOLDER")
    try:
        parsed = urllib.parse.urlsplit(db_url)
        if parsed.fragment:
            # A raw # in a password starts a URI fragment. Percent-encode the password.
            raise RuntimeError("DATABASE_URL_PASSWORD_NOT_ENCODED")
        port = parsed.port
    except RuntimeError:
        raise
    except ValueError as error:
        raise RuntimeError("DATABASE_URL_INVALID") from error
    if (
        parsed.scheme not in {"postgres", "postgresql"}
        or not parsed.hostname
        or not parsed.username
        or parsed.password is None
        or not parsed.path.lstrip("/")
    ):
        raise RuntimeError("DATABASE_URL_INVALID")
    if port is None:
        raise RuntimeError("DATABASE_URL_PORT_MISSING")
    sslmode = urllib.parse.parse_qs(parsed.query).get("sslmode", [])
    if sslmode not in (["require"], ["verify-ca"], ["verify-full"]):
        raise RuntimeError("DATABASE_URL_SSLMODE_REQUIRED")


def classify_database_error(stderr: str) -> str:
    """Map PostgreSQL diagnostics to a safe code that cannot contain credentials."""
    diagnostic = stderr.lower()
    if "password authentication failed" in diagnostic:
        return "DATABASE_AUTHENTICATION_FAILED"
    if "tenant or user not found" in diagnostic or "invalid tenant" in diagnostic:
        return "DATABASE_POOLER_TENANT_NOT_FOUND"
    if "could not translate host name" in diagnostic or "name or service not known" in diagnostic:
        return "DATABASE_DNS_FAILED"
    if "network is unreachable" in diagnostic or "no route to host" in diagnostic:
        return "DATABASE_NETWORK_UNREACHABLE"
    if "connection timed out" in diagnostic or "timeout expired" in diagnostic:
        return "DATABASE_CONNECTION_TIMEOUT"
    if "connection refused" in diagnostic:
        return "DATABASE_CONNECTION_REFUSED"
    if "ssl" in diagnostic or "no pg_hba.conf entry" in diagnostic:
        return "DATABASE_SSL_OR_ACCESS_FAILED"
    if "schema_migrations" in diagnostic and (
        "does not exist" in diagnostic or "permission denied" in diagnostic
    ):
        return "DATABASE_MIGRATION_LEDGER_UNAVAILABLE"
    if "server version" in diagnostic and "pg_dump version" in diagnostic:
        return "PG_DUMP_CLIENT_VERSION_INCOMPATIBLE"
    return "DATABASE_CONNECTION_OR_QUERY_FAILED"


def scalar(db_url: str, sql: str) -> str:
    try:
        result = run_command(["psql", db_url, "-X", "-Atqc", sql])
    except FileNotFoundError as error:
        raise RuntimeError("PSQL_NOT_AVAILABLE") from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError(classify_database_error(error.stderr or "")) from None
    return result.stdout.strip()


def request(url: str, key: str, *, method: str = "POST", body: bytes | None = None, headers: dict[str, str] | None = None) -> tuple[int, bytes]:
    request_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        **(headers or {}),
    }
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, data=body, headers=request_headers, method=method),
            timeout=120,
        ) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        # Never include the response body in a public workflow result.
        raise RuntimeError(f"PRIVATE_BACKUP_HTTP_{error.code}") from error


def register_backup_run(
    supabase_url: str,
    service_key: str,
    *,
    status: str,
    location: str | None,
    checksum: str | None,
    size_bytes: int | None,
    started_at: str,
    completed_at: str,
    error_code: str | None = None,
) -> str | None:
    payload = {
        "backup_type": "logical",
        "status": status,
        "location": location,
        "checksum": checksum,
        "size_bytes": size_bytes,
        "started_at": started_at,
        "completed_at": completed_at if status != "started" else None,
        "error_message": error_code,
    }
    response_status, response_body = request(
        f"{supabase_url.rstrip('/')}/rest/v1/backup_runs",
        service_key,
        body=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    if response_status not in (200, 201):
        raise RuntimeError(f"BACKUP_RUN_REGISTER_HTTP_{response_status}")
    try:
        rows = json.loads(response_body.decode("utf-8"))
        if isinstance(rows, list) and rows and isinstance(rows[0], dict):
            return str(rows[0].get("id") or "") or None
    except (UnicodeDecodeError, json.JSONDecodeError):
        pass
    return None


def lookup_artifact_id(
    supabase_url: str,
    service_key: str,
    *,
    bucket_id: str,
    object_path: str,
) -> str | None:
    query = urllib.parse.urlencode({
        "bucket_id": f"eq.{bucket_id}",
        "object_path": f"eq.{object_path}",
        "select": "id",
        "limit": "1",
    })
    response_status, response_body = request(
        f"{supabase_url.rstrip('/')}/rest/v1/private_data_artifacts?{query}",
        service_key,
        method="GET",
    )
    if response_status != 200:
        raise RuntimeError(f"BACKUP_ARTIFACT_LOOKUP_HTTP_{response_status}")
    rows = json.loads(response_body.decode("utf-8"))
    if isinstance(rows, list) and rows and isinstance(rows[0], dict):
        return str(rows[0].get("id") or "") or None
    return None


def parse_archive_entries(output: str) -> list[str]:
    return [line for line in output.splitlines() if line.strip() and not line.lstrip().startswith(";")]


def write_summary(path: Path, summary: dict) -> None:
    path.write_text(json.dumps(summary, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="migration-backup-result.json")
    parser.add_argument("--requested-migrations", type=int, default=25)
    parser.add_argument("--retention-days", type=int, default=30)
    args = parser.parse_args()

    started = datetime.now(timezone.utc)
    summary: dict = {
        "status": "failed",
        "backup_type": "logical",
        "environment": "production-pre-migration",
        "started_at": started.isoformat(),
        "requested_migration_batch_size": args.requested_migrations,
        "checks": {},
        "rollback": {
            "automatic_down_migration": False,
            "required_action": "stop release and restore the recorded backup anchor through the approved PITR or replacement-database procedure",
        },
    }
    output_path = Path(args.output)
    versions = migration_versions()
    summary["repository_migration_count"] = len(versions)
    summary["target_migration_head"] = versions[-1] if versions else None

    db_url = env("SUPABASE_DB_URL")
    supabase_url = env("SUPABASE_URL")
    service_key = env("SUPABASE_SERVICE_KEY")
    encryption_key = env("BACKUP_ENCRYPTION_KEY")
    run_id = env("MIGRATION_BACKUP_RUN_ID") or (
        f"{env('GITHUB_RUN_ID', 'local')}-{env('GITHUB_RUN_ATTEMPT', '1')}-migration"
    )
    summary["run_id"] = run_id

    required = {
        "SUPABASE_DB_URL": db_url,
        "SUPABASE_URL": supabase_url,
        "SUPABASE_SERVICE_KEY": service_key,
        "BACKUP_ENCRYPTION_KEY": encryption_key,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        summary["error_code"] = "BACKUP_CONFIG_MISSING"
        summary["missing_config"] = missing
        write_summary(output_path, summary)
        return 1
    if (
        not versions
        or args.requested_migrations < 1
        or args.retention_days < 1
        or len(encryption_key) < 24
    ):
        summary["error_code"] = "BACKUP_ARGUMENT_INVALID"
        write_summary(output_path, summary)
        return 1
    try:
        validate_database_url(db_url)
        summary["checks"]["database_url_valid"] = True
    except RuntimeError as error:
        summary["error_code"] = str(error)
        summary["checks"]["database_url_valid"] = False
        write_summary(output_path, summary)
        return 1

    temp_dir = Path(tempfile.mkdtemp(prefix="jay-pre-migration-backup-"))
    location = None
    checksum = None
    size_bytes = None
    error_code = None
    try:
        pre_count = int(scalar(db_url, "SELECT count(*) FROM supabase_migrations.schema_migrations"))
        pre_head = scalar(
            db_url,
            "SELECT COALESCE(max(version), 'none') FROM supabase_migrations.schema_migrations",
        )
        summary["pre_migration_count"] = pre_count
        summary["pre_migration_head"] = pre_head
        summary["pending_migration_count"] = max(0, len(versions) - pre_count)
        summary["rollback"]["pre_migration_head"] = pre_head

        dump_path = temp_dir / "database.dump"
        encrypted_path = temp_dir / "database.dump.enc"
        roundtrip_path = temp_dir / "database.dump.roundtrip"
        try:
            run_command(["pg_dump", db_url, "--format=custom", "--no-owner", "--no-privileges", "--file", str(dump_path)])
            summary["checks"]["pg_dump_created"] = dump_path.is_file() and dump_path.stat().st_size > 0
        except FileNotFoundError as error:
            raise RuntimeError("PG_DUMP_NOT_AVAILABLE") from error
        except subprocess.CalledProcessError as error:
            raise RuntimeError(classify_database_error(error.stderr or "")) from None

        try:
            archive_listing = run_command(["pg_restore", "--list", str(dump_path)]).stdout
            entries = parse_archive_entries(archive_listing)
            summary["archive_entry_count"] = len(entries)
            summary["checks"]["archive_list_valid"] = bool(entries)
            summary["checks"]["migration_ledger_in_archive"] = any("schema_migrations" in line for line in entries)
            if not entries or not summary["checks"]["migration_ledger_in_archive"]:
                raise RuntimeError("BACKUP_ARCHIVE_INCOMPLETE")
        except (OSError, subprocess.CalledProcessError) as error:
            raise RuntimeError("BACKUP_ARCHIVE_LIST_FAILED") from error

        encryption_env = {**os.environ, "BACKUP_ENCRYPTION_KEY": encryption_key}
        try:
            run_command([
                "openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-salt",
                "-in", str(dump_path), "-out", str(encrypted_path),
                "-pass", "env:BACKUP_ENCRYPTION_KEY",
            ], environment=encryption_env)
            run_command([
                "openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
                "-in", str(encrypted_path), "-out", str(roundtrip_path),
                "-pass", "env:BACKUP_ENCRYPTION_KEY",
            ], environment=encryption_env)
            roundtrip_listing = run_command(["pg_restore", "--list", str(roundtrip_path)]).stdout
            roundtrip_entries = parse_archive_entries(roundtrip_listing)
            summary["checks"]["encryption_round_trip"] = (
                bool(roundtrip_entries)
                and len(roundtrip_entries) == summary["archive_entry_count"]
                and any("schema_migrations" in line for line in roundtrip_entries)
            )
            if not summary["checks"]["encryption_round_trip"]:
                raise RuntimeError("BACKUP_ENCRYPTION_ROUND_TRIP_FAILED")
        except (OSError, subprocess.CalledProcessError) as error:
            raise RuntimeError("BACKUP_ENCRYPTION_FAILED") from error

        payload = encrypted_path.read_bytes()
        checksum = hashlib.sha256(payload).hexdigest()
        size_bytes = len(payload)
        summary["checks"]["checksum_computed"] = len(checksum) == 64
        summary["checks"]["encrypted_payload_nonempty"] = size_bytes > 0

        from private_artifact_store import upload_private_bytes

        artifact = upload_private_bytes(
            supabase_url,
            service_key,
            payload,
            run_id=run_id,
            source_key="internal-system",
            artifact_kind="encrypted_backup",
            retention_days=args.retention_days,
            original_name="pre-migration-database.dump.enc",
            content_type="application/octet-stream",
            metadata={
                "purpose": "pre_migration",
                "pre_migration_head": pre_head,
                "target_migration_head": versions[-1],
                "requested_migration_batch_size": args.requested_migrations,
            },
        )
        location = f"{artifact['bucket_id']}/{artifact['object_path']}"
        artifact_id = lookup_artifact_id(
            supabase_url,
            service_key,
            bucket_id=artifact["bucket_id"],
            object_path=artifact["object_path"],
        )
        summary["artifact"] = {
            "id": artifact_id,
            "bucket_id": artifact["bucket_id"],
            "object_path": artifact["object_path"],
            "sha256": artifact["sha256"],
            "byte_size": artifact["byte_size"],
            "retention_until": artifact["retention_until"],
        }
        summary["checks"]["private_artifact_uploaded"] = (
            artifact["sha256"] == checksum and int(artifact["byte_size"]) == size_bytes
        )
        if not summary["checks"]["private_artifact_uploaded"]:
            raise RuntimeError("BACKUP_ARTIFACT_METADATA_MISMATCH")

        backup_run_id = register_backup_run(
            supabase_url,
            service_key,
            status="completed",
            location=location,
            checksum=checksum,
            size_bytes=size_bytes,
            started_at=started.isoformat(),
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        summary["backup_run_id"] = backup_run_id
        summary["checks"]["backup_run_registered"] = True
        summary["rollback"].update({
            "artifact_id": artifact_id,
            "location": location,
            "sha256": checksum,
            "size_bytes": size_bytes,
            "restore_verification": "run the isolated restore drill before any production restore",
        })
        summary["status"] = "passed"
    except Exception as error:  # noqa: BLE001 - summary must be emitted on every failure path.
        error_code = str(error).split(":", 1)[0][:120] or "BACKUP_FAILED"
        summary["error_code"] = error_code
        summary["checks"].setdefault("backup_run_registered", False)
    finally:
        completed_at = datetime.now(timezone.utc).isoformat()
        summary["completed_at"] = completed_at
        if summary["status"] != "passed" and supabase_url and service_key:
            try:
                register_backup_run(
                    supabase_url,
                    service_key,
                    status="failed",
                    location=location,
                    checksum=checksum,
                    size_bytes=size_bytes,
                    started_at=started.isoformat(),
                    completed_at=completed_at,
                    error_code=error_code,
                )
                summary["checks"]["backup_run_registered"] = True
            except Exception:
                summary["checks"]["backup_run_registered"] = False
        for path in temp_dir.iterdir():
            path.unlink(missing_ok=True)
        temp_dir.rmdir()
        write_summary(output_path, summary)

    print(json.dumps(summary, ensure_ascii=True))
    return 0 if summary["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
