import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from collection_telemetry import append_collection_source  # noqa: E402
import validate_data  # noqa: E402


class CollectionTelemetryTests(unittest.TestCase):
    def test_append_upserts_source_and_recalculates_pipeline_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "collection_run.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump({
                    "schema_version": 1,
                    "started_at": "2026-09-07T00:00:00+00:00",
                    "scope": {"market_codes": ["US"], "platform_keys": ["amazon"]},
                    "sources": [{
                        "key": "federal_register", "label": "Federal Register", "domain": "policy",
                        "core": True, "status": "succeeded", "duration_ms": 10,
                        "request_count": 1, "successful_requests": 1, "failed_requests": 0,
                        "records_collected": 2, "records_in_scope": 2,
                    }],
                }, handle)

            payload = append_collection_source({
                "key": "cpsc_recalls", "label": "CPSC", "domain": "alert",
                "market_codes": ["us"], "status": "degraded",
                "request_count": 2, "successful_requests": 1, "failed_requests": 1,
                "records_collected": 3, "records_in_scope": 3, "cache_used": True,
            }, path=path)
            payload = append_collection_source({
                "key": "cpsc_recalls", "label": "CPSC", "domain": "alert",
                "market_codes": ["US"], "status": "succeeded",
                "request_count": 2, "successful_requests": 2, "failed_requests": 0,
                "records_collected": 4, "records_in_scope": 4,
            }, path=path)

        self.assertEqual(payload["schema_version"], 2)
        self.assertEqual(len(payload["sources"]), 2)
        self.assertEqual(payload["summary"]["sources"], 2)
        self.assertEqual(payload["summary"]["succeeded"], 2)
        self.assertEqual(payload["summary"]["records_in_scope"], 6)
        cpsc = next(row for row in payload["sources"] if row["key"] == "cpsc_recalls")
        self.assertEqual(cpsc["status"], "succeeded")
        self.assertEqual(cpsc["market_codes"], ["US"])
        self.assertNotIn("cache_used", cpsc)

    def test_schema_v2_quality_gate_requires_all_pipeline_source_rows(self):
        now = datetime(2026, 9, 7, tzinfo=timezone.utc)
        manifest = {
            "markets": [{"code": "US", "status": "active", "data_status": "configured"}],
            "market_platforms": [],
        }
        source = {
            "key": "federal_register", "label": "Federal Register", "domain": "policy",
            "core": True, "status": "succeeded", "duration_ms": 1,
            "request_count": 1, "successful_requests": 1, "failed_requests": 0,
            "records_collected": 1, "records_in_scope": 1,
        }
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "collection_run.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump({
                    "schema_version": 2, "completed_at": now.isoformat(),
                    "legacy_global_writes": False,
                    "scope": {"market_codes": ["US"], "platform_keys": []},
                    "sources": [source],
                }, handle)
            result = validate_data.validate_collection_run(now, path=path, manifest=manifest)

        self.assertEqual(result.status, "failed")
        self.assertTrue(any("cpsc_recalls" in error for error in result.errors))
        self.assertTrue(any("fred_bls_macro" in error for error in result.errors))
        self.assertTrue(any("us_market_categories" in error for error in result.errors))
        self.assertEqual(result.metrics["pipeline_sources"], [])
        self.assertEqual(
            result.metrics["missing_pipeline_sources"],
            ["cpsc_recalls", "fred_bls_macro", "us_market_categories"],
        )

    def test_pipeline_sources_are_not_required_when_us_is_not_configured(self):
        now = datetime(2026, 9, 7, tzinfo=timezone.utc)
        manifest = {
            "markets": [{"code": "ID", "status": "active", "data_status": "configured"}],
            "market_platforms": [],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "collection_run.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump({
                    "schema_version": 2, "started_at": now.isoformat(),
                    "completed_at": now.isoformat(), "status": "healthy",
                    "legacy_global_writes": False,
                    "scope": {"market_codes": ["ID"], "platform_keys": []},
                    "summary": {
                        "sources": 0, "succeeded": 0, "degraded": 0, "failed": 0,
                        "core_failures": [], "records_collected": 0, "records_in_scope": 0,
                    },
                    "sources": [],
                }, handle)
            result = validate_data.validate_collection_run(now, path=path, manifest=manifest)

        self.assertEqual(result.status, "healthy")
        self.assertEqual(result.metrics["pipeline_sources"], [])
        self.assertEqual(result.metrics["missing_pipeline_sources"], [])

    def test_complete_us_pipeline_is_healthy_and_exposes_pipeline_metrics(self):
        now = datetime(2026, 9, 7, tzinfo=timezone.utc)
        manifest = {
            "markets": [{"code": "US", "status": "active", "data_status": "configured"}],
            "market_platforms": [],
        }
        rows = []
        for key in ("us_market_categories", "cpsc_recalls", "fred_bls_macro"):
            rows.append({
                "key": key, "label": key, "domain": "market", "core": key == "us_market_categories",
                "status": "succeeded", "duration_ms": 10, "request_count": 1,
                "successful_requests": 1, "failed_requests": 0,
                "records_collected": 2, "records_in_scope": 2,
            })
        rows.append({
            "key": "federal_register", "label": "Federal Register", "domain": "policy",
            "core": True, "status": "succeeded", "duration_ms": 10, "request_count": 1,
            "successful_requests": 1, "failed_requests": 0,
            "records_collected": 2, "records_in_scope": 2,
        })
        ledger_summary = {
            "sources": 4, "succeeded": 4, "degraded": 0, "failed": 0,
            "core_failures": [], "records_collected": 8, "records_in_scope": 8,
        }
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "collection_run.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump({
                    "schema_version": 2, "completed_at": now.isoformat(),
                    "legacy_global_writes": False,
                    "scope": {"market_codes": ["US"], "platform_keys": []},
                    "started_at": now.isoformat(),
                    "status": "healthy",
                    "summary": ledger_summary,
                    "sources": rows,
                }, handle)
            result = validate_data.validate_collection_run(now, path=path, manifest=manifest)

        self.assertEqual(result.status, "healthy")
        self.assertEqual(
            result.metrics["pipeline_sources"],
            ["cpsc_recalls", "fred_bls_macro", "us_market_categories"],
        )
        self.assertEqual(result.metrics["missing_pipeline_sources"], [])

    def test_missing_us_collection_run_is_not_publishable(self):
        now = datetime(2026, 9, 7, tzinfo=timezone.utc)
        manifest = {
            "markets": [{"code": "US", "status": "active", "data_status": "configured"}],
            "market_platforms": [],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "missing-collection-run.json")
            result = validate_data.validate_collection_run(now, path=path, manifest=manifest)

        self.assertEqual(result.status, "failed")
        self.assertFalse(result.connected)
        self.assertTrue(any("缺少本轮结构化采集运行记录" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
