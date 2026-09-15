import json
import os
import sys
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import source_governance  # noqa: E402
import collect_data  # noqa: E402
import sync_to_supabase  # noqa: E402
import validate_source_registry  # noqa: E402


class SourceGovernanceTests(unittest.TestCase):
    def test_all_production_collector_references_are_registered(self):
        report = validate_source_registry.validate_source_registry()
        self.assertTrue(report["ok"], report["errors"])
        self.assertIn("federal-register", report["referenced_source_keys"])
        self.assertIn("platform-official", report["registered_source_keys"])

    def test_expired_source_is_stopped_without_mutating_static_registry(self):
        override = {
            "sources": {
                "federal-register": {
                    "access_policy": {
                        "authorization_expires_at": "2026-01-01T00:00:00+00:00"
                    }
                }
            }
        }
        with patch.dict(os.environ, {
            "SOURCE_GOVERNANCE_JSON": json.dumps(override),
            "SOURCE_GOVERNANCE_NOW": "2026-09-12T00:00:00+00:00",
        }, clear=False):
            self.assertFalse(source_governance.source_is_collectable("federal-register"))
            with self.assertRaises(source_governance.SourceGovernanceError):
                source_governance.assert_source_collectable("federal-register")
        self.assertTrue(source_governance.source_is_collectable("federal-register"))

    def test_inactive_source_does_not_make_an_http_request(self):
        override = {"sources": {"ustr": {"status": "inactive"}}}
        collect_data.reset_collection_telemetry({"market_codes": ["US"]})
        with patch.dict(os.environ, {"SOURCE_GOVERNANCE_JSON": json.dumps(override)}, clear=False), \
                patch.object(collect_data, "urlopen") as urlopen:
            result = collect_data.fetch_html(
                "https://ustr.gov/news-events",
                source_key="ustr",
                source_label="USTR",
                domain="policy",
                core=True,
            )
        self.assertIsNone(result)
        urlopen.assert_not_called()
        self.assertEqual(collect_data.COLLECTION_SOURCES["ustr"]["collector_status"], "skipped")
        self.assertEqual(collect_data.build_collection_report()["summary"]["core_failures"], ["ustr"])

    def test_unknown_source_is_rejected(self):
        with self.assertRaises(source_governance.SourceGovernanceError):
            source_governance.assert_source_collectable("unregistered-provider")

    def test_pending_third_party_source_is_quarantined_not_publishable(self):
        self.assertTrue(source_governance.source_is_collectable("tikhub"))
        self.assertFalse(source_governance.source_is_publishable("tikhub"))
        record = source_governance.quarantine_unlicensed_record(
            {"title": "Licensed result"}, "tikhub"
        )
        self.assertEqual(record["publication_status"], "quarantined")
        self.assertEqual(record["source_category"], "third_party_provider")
        self.assertFalse(record["redistribution_allowed"])

    def test_source_category_and_access_fields_are_exported_to_rows(self):
        rows = sync_to_supabase.build_source_registry_rows()
        fred = next(row for row in rows if row["source_key"] == "fred")
        self.assertEqual(fred["source_category"], "official_statistics")
        policies = sync_to_supabase.build_source_policy_rows([fred])
        policy = policies[0]
        self.assertEqual(policy["authorization_status"], "not_required")
        self.assertIn("allowed_display_fields", policy)
        self.assertIn("api_pricing", policy)
        categories = {
            row["source_key"]: row["source_category"]
            for row in source_governance.registry_rows()
        }
        self.assertEqual(categories["federal-register"], "official_policy")
        self.assertEqual(categories["platform-official"], "platform_announcement")
        self.assertEqual(categories["traceable-feed"], "industry_media")
        self.assertEqual(categories["tikhub"], "third_party_provider")

    def test_unlicensed_raw_record_has_quarantine_metadata(self):
        record = {
            "id": "tikhub-1",
            "title": "Private result",
            "market": "US",
            "source": "TikHub",
            "source_url": "https://api.tikhub.io/api/v1/example",
            "source_kind": "traceable",
            "source_type": "licensed_provider",
            "verification_status": "verified",
            "collected_at": "2026-09-12T00:00:00+00:00",
            "published_at": "2026-09-11",
            "evidence_hash": "b" * 64,
        }
        with patch.object(sync_to_supabase, "iter_provenance_records", return_value=[("policies", "policy", record, 0)]):
            rows = sync_to_supabase.build_raw_record_rows()
        self.assertEqual(rows[0]["source_category"], "third_party_provider")
        self.assertEqual(rows[0]["publication_status"], "quarantined")
        self.assertEqual(rows[0]["allowed_export_fields"], [])


if __name__ == "__main__":
    unittest.main()
