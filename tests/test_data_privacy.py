import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, os.fspath(ROOT / "scripts"))

import private_artifact_store  # noqa: E402
import repository_privacy_check  # noqa: E402
import history_privacy_scan  # noqa: E402
import sync_to_supabase  # noqa: E402


class DataPrivacyTests(unittest.TestCase):
    def test_restricted_repository_paths_are_rejected(self):
        self.assertEqual(
            repository_privacy_check.restricted_path_reason("data/providers/tikhub/response.json"),
            "restricted directory",
        )
        self.assertEqual(
            repository_privacy_check.restricted_path_reason("data/us_market/electronics.json"),
            "private US category dataset",
        )
        self.assertEqual(
            repository_privacy_check.restricted_path_reason("reports/us_market/electronics_report.pdf"),
            "legacy generated PDF",
        )
        self.assertIsNone(
            repository_privacy_check.restricted_path_reason("data/policies.json")
        )

    def test_high_confidence_provider_key_is_detected_without_printing_value(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "config.txt"
            path.write_text("API_KEY=sk-" + "A" * 30, encoding="utf-8")
            findings = repository_privacy_check.secret_findings(root, ["config.txt"])
        self.assertEqual(findings, ["config.txt:1: possible provider API key"])
        self.assertNotIn("A" * 10, findings[0])

    def test_tikhub_is_private_raw_evidence_and_never_a_public_projection(self):
        record = {
            "id": "tikhub-video-1",
            "title": "Licensed result",
            "market": "US",
            "source": "TikHub",
            "source_url": "https://api.tikhub.io/api/v1/example",
            "source_kind": "traceable",
            "source_type": "licensed_provider",
            "source_record_id": "tikhub-video-1",
            "verification_status": "verified",
            "collected_at": "2026-09-12T00:00:00+00:00",
            "published_at": "2026-09-11",
            "evidence_hash": "a" * 64,
        }
        records = [("policies", "policy", record, 0)]
        with patch.object(sync_to_supabase, "iter_provenance_records", return_value=records):
            raw = sync_to_supabase.build_raw_record_rows()
            formal = sync_to_supabase.build_applicability_rows()
        public = sync_to_supabase.public_market_data_payload(
            "policies", {"items": [record]}
        )
        self.assertEqual(raw[0]["source_key"], "tikhub")
        self.assertEqual(raw[0]["license_class"], "commercial")
        self.assertFalse(raw[0]["redistribution_allowed"])
        self.assertEqual(formal, [])
        self.assertEqual(public["items"], [])

    def test_private_artifact_upload_registers_metadata_not_file_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "raw-response.json"
            path.write_text('{"private":"payload"}', encoding="utf-8")
            with patch.object(
                private_artifact_store,
                "_request",
                side_effect=[(201, b""), (201, b"")],
            ) as request_mock:
                row = private_artifact_store.upload_private_artifact(
                    "https://example.supabase.co",
                    "service-key",
                    path,
                    run_id="run-1",
                    source_key="tikhub",
                    artifact_kind="licensed_dataset",
                    retention_days=30,
                )
        self.assertEqual(row["source_key"], "tikhub")
        self.assertEqual(row["bucket_id"], "private-raw-data")
        registry_body = json.loads(request_mock.call_args_list[1].kwargs["body"])
        self.assertNotIn("payload", json.dumps(registry_body))

    def test_private_artifact_discovery_assigns_source_retention(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "data" / "providers" / "tikhub" / "response.json"
            path.parent.mkdir(parents=True)
            path.write_text("{}", encoding="utf-8")
            artifacts = list(sync_to_supabase.iter_private_artifacts(root))
        self.assertEqual(len(artifacts), 1)
        self.assertEqual(artifacts[0]["source_key"], "tikhub")
        self.assertEqual(artifacts[0]["retention_days"], 30)

    def test_history_scan_reports_restricted_paths_without_exposing_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess = __import__("subprocess")
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            (root / "data").mkdir()
            (root / "data" / "_sync_logs").mkdir()
            (root / "data" / "_sync_logs" / "run.json").write_text("{}", encoding="utf-8")
            (root / "reports").mkdir()
            (root / "reports" / "legacy.pdf").write_bytes(b"%PDF-1.4 fixture")
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(["git", "-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-qm", "fixture"], cwd=root, check=True)
            result = history_privacy_scan.scan_history(root)
        self.assertEqual(result["secret_findings"], [])
        self.assertTrue(result["repository_complete"])
        self.assertTrue(result["secret_scan_complete"])
        self.assertEqual(result["reachable_blob_count"], result["scanned_blob_count"])
        self.assertTrue(any(item["path"] == "data/_sync_logs/run.json" for item in result["restricted_paths"]))
        self.assertTrue(any(item["path"] == "reports/legacy.pdf" for item in result["restricted_paths"]))


if __name__ == "__main__":
    unittest.main()
