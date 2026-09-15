import copy
import os
import sys
import unittest


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import sync_to_supabase  # noqa: E402


class PermanentHistoryTests(unittest.TestCase):
    def setUp(self):
        self.collection_run = {
            "run_id": "run-history-test",
            "started_at": "2026-09-18T00:00:00+00:00",
            "completed_at": "2026-09-18T00:05:00+00:00",
            "scope": {"market_codes": ["US"], "platform_keys": ["amazon"]},
            "sources": [{
                "key": "amazon_rules", "source_key": "platform-official",
                "domain": "rule", "status": "succeeded",
                "started_at": "2026-09-18T00:00:00+00:00",
                "completed_at": "2026-09-18T00:00:01+00:00",
                "request_count": 1, "successful_requests": 1,
                "failed_requests": 0, "records_collected": 1,
                "records_in_scope": 1,
            }],
        }

    def _raw(self, payload, evidence):
        return [{
            "source_key": "platform-official", "domain": "rule",
            "source_record_id": "amazon-rule-1", "source_url": "https://example.test/rule",
            "source_kind": "official", "source_type": "platform",
            "source_category": "platform_announcement",
            "verification_status": "verified", "publication_status": "eligible",
            "market_codes": ["US"], "platform_keys": ["amazon"],
            "category_codes": [], "jurisdiction_codes": ["US"],
            "collected_at": payload["collected_at"], "published_at": "2026-09-01",
            "effective_from": "2026-09-01", "effective_to": None,
            "evidence_hash": evidence, "payload": payload,
            "allowed_display_fields": ["title", "summary", "published_at"],
            "allowed_export_fields": ["title", "summary"],
        }]

    def test_same_run_is_shared_and_history_ids_are_deterministic(self):
        rows = sync_to_supabase.build_source_fetch_run_rows(self.collection_run)
        self.assertEqual(rows[0]["run_id"], "run-history-test")
        self.assertEqual(rows[0]["source_key"], "platform-official")
        first = sync_to_supabase.build_history_rows(
            {"collection_run": self.collection_run},
            self._raw({
                "title": "Amazon fee", "summary": "4%", "commission": "4%",
                "collected_at": "2026-09-18T00:00:01+00:00",
                "platform": "amazon", "market": "US",
            }, "a" * 64),
            [{
                "source_key": "platform-official", "source_record_id": "amazon-rule-1",
                "evidence_hash": "a" * 64, "domain": "rule", "record_key": "amazon-rule-1",
                "market_code": "US", "platform_key": "amazon",
                "category_code": None, "jurisdiction_code": "US",
            }],
        )
        second = sync_to_supabase.build_history_rows(
            {"collection_run": copy.deepcopy(self.collection_run)},
            self._raw({
                "title": "Amazon fee", "summary": "4%", "commission": "4%",
                "collected_at": "2026-09-18T00:00:01+00:00",
                "platform": "amazon", "market": "US",
            }, "a" * 64),
            [{
                "source_key": "platform-official", "source_record_id": "amazon-rule-1",
                "evidence_hash": "a" * 64, "domain": "rule", "record_key": "amazon-rule-1",
                "market_code": "US", "platform_key": "amazon",
                "category_code": None, "jurisdiction_code": "US",
            }],
        )
        self.assertEqual(first["raw_source_records"][0]["id"], second["raw_source_records"][0]["id"])
        self.assertEqual(first["platform_rule_versions"][0]["id"], second["platform_rule_versions"][0]["id"])
        self.assertEqual(first["formal_publications"][0]["raw_source_record_id"], first["raw_source_records"][0]["id"])

    def test_rule_versions_keep_scope_and_normalized_dimensions(self):
        rows = sync_to_supabase.build_history_rows(
            {"collection_run": self.collection_run},
            self._raw({
                "title": "Amazon fee", "summary": "4%", "commission": "4%",
                "deposit": "10", "collected_at": "2026-09-18T00:00:01+00:00",
                "platform": "amazon", "market": "US",
            }, "b" * 64),
            [],
        )
        self.assertEqual(len(rows["platform_rules"]), 1)
        self.assertEqual(rows["platform_rules"][0]["platform_rule_id"], "amazon-rule-1")
        self.assertEqual(rows["platform_rule_versions"][0]["rule_dimensions"]["commission"], "4%")
        self.assertEqual(rows["platform_rule_versions"][0]["rule_dimensions"]["deposit"], "10")

    def test_product_shop_content_require_stable_platform_ids(self):
        raw = []
        for kind, stable, metrics in (
            ("product", "sku-1", {"price": 10}),
            ("shop", "shop-1", {"gmv": 200, "followers": 1000}),
            ("content", "video-1", {"views": 5000, "likes": 100}),
        ):
            payload = {
                "snapshot_type": kind, "platform": "amazon", "market": "US",
                f"platform_{kind}_id": stable, "title": stable,
                "collected_at": "2026-09-18T00:00:01+00:00", **metrics,
            }
            raw.append({
                "source_key": "platform-official", "domain": kind,
                "source_record_id": f"{kind}-record", "source_kind": "official",
                "source_type": "platform", "source_category": "platform_announcement",
                "verification_status": "verified", "publication_status": "quarantined",
                "market_codes": ["US"], "platform_keys": ["amazon"],
                "category_codes": [], "jurisdiction_codes": [],
                "collected_at": payload["collected_at"], "evidence_hash": str(len(raw) + 1) * 64,
                "payload": payload, "allowed_display_fields": [],
                "allowed_export_fields": [],
            })
        rows = sync_to_supabase.build_history_rows(
            {"collection_run": self.collection_run}, raw, []
        )
        self.assertEqual(len(rows["product_entities"]), 1)
        self.assertEqual(len(rows["shop_entities"]), 1)
        self.assertEqual(len(rows["content_entities"]), 1)
        self.assertEqual(len(rows["product_snapshots"]), 1)
        self.assertEqual(rows["shop_snapshots"][0]["followers"], 1000)
        self.assertEqual(rows["content_snapshots"][0]["views"], 5000)

    def test_product_price_history_keeps_multiple_collection_dates(self):
        raw = []
        for day, price, digest in (("2026-09-17", 10, "c"), ("2026-09-18", 12, "d")):
            raw.append({
                "source_key": "platform-official", "domain": "product",
                "source_record_id": f"product-{day}", "source_kind": "official",
                "source_type": "platform", "source_category": "platform_announcement",
                "verification_status": "verified", "publication_status": "quarantined",
                "market_codes": ["US"], "platform_keys": ["amazon"],
                "category_codes": [], "jurisdiction_codes": [],
                "collected_at": f"{day}T00:00:00+00:00", "evidence_hash": digest * 64,
                "payload": {
                    "snapshot_type": "product", "platform": "amazon", "market": "US",
                    "platform_product_id": "sku-1", "price": price,
                },
                "allowed_display_fields": [], "allowed_export_fields": [],
            })
        rows = sync_to_supabase.build_history_rows(
            {"collection_run": self.collection_run}, raw, []
        )
        self.assertEqual(len(rows["product_entities"]), 1)
        self.assertEqual(len(rows["product_snapshots"]), 2)
        self.assertEqual(
            {snapshot["price"] for snapshot in rows["product_snapshots"]}, {10, 12}
        )


if __name__ == "__main__":
    unittest.main()
