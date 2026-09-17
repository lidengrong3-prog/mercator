import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, os.fspath(ROOT / "scripts"))

import backup_storage  # noqa: E402
import private_artifact_store  # noqa: E402
import restore_backup_drill  # noqa: E402


class StorageBackupTests(unittest.TestCase):
    def test_list_objects_paginates_every_prefix(self):
        def fake_request(_url, _key, **kwargs):
            payload = json.loads(kwargs["body"])
            prefix = payload["prefix"]
            offset = payload["offset"]
            pages = {
                ("", 0): [
                    {"id": "1", "name": "a.json", "metadata": {}},
                    {"id": None, "name": "folder", "metadata": None},
                ],
                ("", 2): [{"id": "2", "name": "b.json", "metadata": {}}],
                ("folder/", 0): [{"id": "3", "name": "nested.json", "metadata": {}}],
            }
            return json.dumps(pages[(prefix, offset)]).encode()

        stats = {"pages": 0}
        with patch.object(backup_storage, "request", side_effect=fake_request):
            names = backup_storage.list_objects(
                "https://example.supabase.co",
                "service-key",
                "private-raw-data",
                page_size=2,
                stats=stats,
            )

        self.assertEqual(names, ["a.json", "b.json", "folder/nested.json"])
        self.assertEqual(stats["pages"], 3)

    def test_backup_artifact_exclusions_are_paginated(self):
        rows = [
            [{"bucket_id": "private-raw-data", "object_path": "backup-a"}],
            [{"bucket_id": "private-raw-data", "object_path": "backup-b"}],
            [],
        ]
        with patch.object(
            backup_storage,
            "request",
            side_effect=[json.dumps(page).encode() for page in rows],
        ):
            excluded = backup_storage.excluded_backup_paths(
                "https://example.supabase.co",
                "service-key",
                page_size=1,
            )
        self.assertEqual(excluded["private-raw-data"], {"backup-a", "backup-b"})

    def test_storage_object_path_cannot_escape_bucket_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "STORAGE_OBJECT_PATH_INVALID"):
                backup_storage.safe_destination(Path(directory), "../outside.txt")

    def test_archive_excludes_prior_backups_and_records_object_hashes(self):
        payloads = {
            "raw.json": b'{"raw":true}',
            "report.pdf": b"%PDF fixture",
        }

        def fake_list(_base, _key, bucket, **kwargs):
            kwargs["stats"]["pages"] = 2
            if bucket == "private-raw-data":
                return ["raw.json", "old-backup.enc"]
            return ["report.pdf"]

        def fake_download(_base, _key, _bucket, name, destination, _remaining):
            payload = payloads[name]
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(payload)
            return len(payload), hashlib.sha256(payload).hexdigest()

        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "storage.tar.gz"
            summary_path = Path(directory) / "summary.json"
            with patch.dict(backup_storage.os.environ, {
                "SUPABASE_URL": "https://example.supabase.co",
                "SUPABASE_SERVICE_KEY": "service-key",
                "STORAGE_BACKUP_MAX_BYTES": "10000",
            }, clear=True), patch.object(
                backup_storage,
                "excluded_backup_paths",
                return_value={"private-raw-data": {"old-backup.enc"}},
            ), patch.object(
                backup_storage,
                "list_objects",
                side_effect=fake_list,
            ), patch.object(
                backup_storage,
                "download_object",
                side_effect=fake_download,
            ):
                exit_code = backup_storage.main([
                    "--output", os.fspath(archive_path),
                    "--summary-output", os.fspath(summary_path),
                ])

            self.assertEqual(exit_code, 0)
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            self.assertEqual(summary["status"], "created")
            self.assertEqual(summary["total_objects"], 2)
            self.assertEqual(summary["excluded_backup_objects"], 1)
            with tarfile.open(archive_path, "r:gz") as archive:
                names = archive.getnames()
                self.assertNotIn("private-raw-data/old-backup.enc", names)
                manifest = json.load(archive.extractfile("manifest.json"))
            self.assertEqual(manifest["total_objects"], 2)
            self.assertEqual(
                manifest["buckets"]["private-raw-data"]["entries"][0]["sha256"],
                hashlib.sha256(payloads["raw.json"]).hexdigest(),
            )

    def test_uploaded_storage_backup_is_registered_once(self):
        row = {
            "artifact_kind": "storage_backup",
            "bucket_id": "private-raw-data",
            "object_path": "internal-system/run/storage.enc",
            "sha256": "a" * 64,
            "byte_size": 42,
            "captured_at": "2026-09-17T00:00:00+00:00",
        }
        with patch.object(
            private_artifact_store,
            "_request",
            side_effect=[(200, b"[]"), (201, b'[{"id":"backup-run"}]')],
        ) as request_mock:
            backup_run_id = private_artifact_store.register_completed_backup(
                "https://example.supabase.co", "service-key", row
            )
        self.assertEqual(backup_run_id, "backup-run")
        self.assertEqual(request_mock.call_count, 2)
        payload = json.loads(request_mock.call_args_list[1].kwargs["body"])
        self.assertEqual(payload["backup_type"], "storage")
        self.assertNotIn("service-key", json.dumps(payload))


class RestoreDrillTests(unittest.TestCase):
    def test_restore_requires_explicit_isolation_confirmation(self):
        with self.assertRaisesRegex(RuntimeError, "RESTORE_DRILL_ISOLATION_NOT_CONFIRMED"):
            restore_backup_drill.validate_isolated_target(
                "postgresql://restore@restore.example/db",
                "postgresql://prod@prod.example/db",
                "false",
            )

    def test_restore_rejects_same_database_endpoint(self):
        with self.assertRaisesRegex(RuntimeError, "RESTORE_DRILL_TARGET_MATCHES_PRODUCTION"):
            restore_backup_drill.validate_isolated_target(
                "postgresql://restore@db.example.com:5432/postgres",
                "postgresql://prod@db.example.com:5432/postgres",
                "true",
            )

    def test_restore_rejects_same_supabase_project_across_poolers(self):
        project = "ftlzofrnosgvdvwajhuz"
        with self.assertRaisesRegex(RuntimeError, "RESTORE_DRILL_TARGET_MATCHES_PRODUCTION_PROJECT"):
            restore_backup_drill.validate_isolated_target(
                f"postgresql://postgres@db.{project}.supabase.co/postgres",
                f"postgresql://postgres.{project}@aws-1.pooler.supabase.com/postgres",
                "true",
            )

    def test_storage_archive_verification_checks_manifest_size_and_hash(self):
        payload = b"report contents"
        digest = hashlib.sha256(payload).hexdigest()
        manifest = {
            "total_objects": 1,
            "total_bytes": len(payload),
            "buckets": {
                "reports": {
                    "objects": 1,
                    "bytes": len(payload),
                    "entries": [{"path": "report.pdf", "size_bytes": len(payload), "sha256": digest}],
                }
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "storage.tar.gz"
            with tarfile.open(archive_path, "w:gz") as archive:
                manifest_bytes = json.dumps(manifest).encode()
                manifest_info = tarfile.TarInfo("manifest.json")
                manifest_info.size = len(manifest_bytes)
                archive.addfile(manifest_info, io.BytesIO(manifest_bytes))
                payload_info = tarfile.TarInfo("reports/report.pdf")
                payload_info.size = len(payload)
                archive.addfile(payload_info, io.BytesIO(payload))
            result = restore_backup_drill.verify_storage_archive(archive_path)
        self.assertEqual(result, {"objects": 1, "bytes": len(payload), "buckets": 1})

    def test_restore_contract_checks_migrations_rls_and_storage_archive(self):
        source = (ROOT / "scripts" / "restore_backup_drill.py").read_text(encoding="utf-8")
        workflow = (ROOT / ".github" / "workflows" / "restore-drill.yml").read_text(encoding="utf-8")
        self.assertIn("supabase_migrations.schema_migrations", source)
        self.assertIn("relrowsecurity", source)
        self.assertIn("storage_archive_verified", source)
        self.assertIn("PRODUCTION_DB_URL", workflow)
        self.assertIn("RESTORE_DRILL_CONFIRM_ISOLATED", workflow)


if __name__ == "__main__":
    unittest.main()
