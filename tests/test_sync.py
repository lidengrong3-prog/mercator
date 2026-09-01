import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import sync_to_supabase  # noqa: E402


class SyncTests(unittest.TestCase):
    def test_public_bundle_is_built_for_frontend_market_data_table(self):
        report = {
            "generated_at": "2026-08-27T00:00:00+00:00",
            "status": "healthy",
            "datasets": {},
        }
        rows = sync_to_supabase.build_market_data_rows(report)
        self.assertEqual(
            {row["key"] for row in rows},
            {"countries", "platforms", "policies", "taxes", "access_requirements", "rules", "alerts", "quality_report"},
        )
        self.assertTrue(all(set(row) == {"key", "data", "meta"} for row in rows))

    def test_legacy_table_fanout_is_opt_in(self):
        old = os.environ.pop("SUPABASE_SYNC_LEGACY_TABLES", None)
        try:
            self.assertFalse(sync_to_supabase.legacy_tables_enabled())
            os.environ["SUPABASE_SYNC_LEGACY_TABLES"] = "1"
            self.assertTrue(sync_to_supabase.legacy_tables_enabled())
        finally:
            if old is None:
                os.environ.pop("SUPABASE_SYNC_LEGACY_TABLES", None)
            else:
                os.environ["SUPABASE_SYNC_LEGACY_TABLES"] = old

    def test_raw_provenance_rows_keep_source_and_evidence_fields(self):
        rows = sync_to_supabase.build_raw_record_rows({"datasets": {}})
        self.assertGreater(len(rows), 0)
        self.assertTrue(all(row["source_key"] for row in rows))
        self.assertTrue(all(row["source_record_id"] for row in rows))
        self.assertTrue(all(row["evidence_hash"] for row in rows))
        self.assertTrue(all(row["verification_status"] in {"verified", "uploaded", "pending", "rejected"} for row in rows))
        self.assertTrue({"policies", "taxes", "access_requirements", "rules", "alerts"}.issubset(set(sync_to_supabase.PROVENANCE_DATASETS)))
        self.assertTrue({"macro", "cpsc"}.issubset({key for key, _, _, _ in sync_to_supabase.iter_provenance_records()}))
        self.assertIn("retrieved_at", rows[0])

    def test_source_registry_covers_raw_record_source_keys(self):
        registry = {row["source_key"] for row in sync_to_supabase.build_source_registry_rows()}
        raw_sources = {row["source_key"] for row in sync_to_supabase.build_raw_record_rows()}
        self.assertTrue(raw_sources.issubset(registry))

    def test_market_catalog_keeps_country_data_source_metadata(self):
        rows = sync_to_supabase.build_catalog_rows()["market_catalog"]
        us = next(row for row in rows if row["code"] == "US")
        self.assertEqual(
            us["metadata"]["data_sources"]["macro"]["local_path"],
            "data/us_market/macro_indicators.json",
        )
        self.assertEqual(us["metadata"]["data_sources"]["macro"]["source_kind"], "official")
        self.assertEqual(
            us["metadata"]["data_sources"]["macro"]["commerce_profile"]["indicator_map"]["ecommerce_sales"],
            "ECOMSA",
        )

    def test_applicability_projection_contains_formal_records_only(self):
        rows = sync_to_supabase.build_applicability_rows({"datasets": {}})
        self.assertGreater(len(rows), 0)
        self.assertTrue(all(row["market_code"] == "US" for row in rows))
        self.assertTrue(all(row["verification_status"] in {"verified", "uploaded"} for row in rows))
        self.assertTrue(all(row["source_record_id"] and row["evidence_hash"] for row in rows))
        self.assertEqual(sum(row["domain"] == "rule" for row in rows), 5)

    def test_industry_advisory_is_retained_raw_but_excluded_from_formal_projection(self):
        record = {
            "id": "industry-us-1",
            "title": "美国跨境平台费用提醒",
            "title_zh": "美国跨境平台费用提醒",
            "summary": "美国卖家需要关注费用变化。",
            "summary_zh": "美国卖家需要关注费用变化。",
            "translation": {"status": "source_zh", "source_hash": "test"},
            "source": "雨果网",
            "source_url": "https://www.cifnews.com/article/industry-us-1",
            "market_codes": ["US"],
            "market": "US",
            "published_at": "2026-08-30",
            "collected_at": "2026-08-30T00:00:00+00:00",
        }
        with patch.object(sync_to_supabase, "iter_provenance_records", return_value=[("policies", "policy", record, 0)]):
            raw = sync_to_supabase.build_raw_record_rows({"datasets": {}})
            formal = sync_to_supabase.build_applicability_rows({"datasets": {}})
        self.assertEqual(len(raw), 1)
        self.assertEqual(raw[0]["source_class"], "industry_advisory")
        self.assertEqual(formal, [])

    def test_public_policy_bundle_marks_legacy_industry_articles_as_pending(self):
        source = {
            "updated_at": "2026-08-30T00:00:00+00:00",
            "items": [{
                "id": "legacy-industry-1",
                "title": "美国跨境平台费用变化",
                "summary": "美国卖家应关注平台费用和进口成本。",
                "title_zh": "美国跨境平台费用变化",
                "summary_zh": "美国卖家应关注平台费用和进口成本。",
                "translation": {"status": "source_zh"},
                "source": "AMZ123",
                "source_url": "https://www.amz123.com/t/legacy-industry-1",
                "region": "Global",
                "published_at": "2026-08-30",
                "collected_at": "2026-08-30T00:00:00+00:00",
            }],
        }
        public = sync_to_supabase.public_market_data_payload("policies", source)
        item = public["items"][0]
        self.assertEqual(item["source_class"], "industry_advisory")
        self.assertEqual(item["source_kind"], "traceable")
        self.assertEqual(item["source_type"], "licensed_provider")
        self.assertEqual(item["verification_status"], "pending")
        self.assertEqual(item["market_codes"], ["US"])
        self.assertNotIn("source_class", source["items"][0])

    def test_public_policy_bundle_preserves_declared_industry_scope(self):
        source = {
            "updated_at": "2026-08-30T00:00:00+00:00",
            "items": [{
                "id": "declared-industry-1",
                "title": "平台费用变化",
                "title_zh": "平台费用变化",
                "summary": "",
                "summary_zh": "",
                "translation": {"status": "source_zh"},
                "source": "AMZ123",
                "source_url": "https://www.amz123.com/t/declared-industry-1",
                "market_codes": ["US"],
                "region": "Global",
                "published_at": "2026-08-30",
                "collected_at": "2026-08-30T00:00:00+00:00",
            }],
        }
        public = sync_to_supabase.public_market_data_payload("policies", source)
        self.assertEqual(public["items"][0]["market_codes"], ["US"])

    def test_applicability_projection_expands_declared_platforms_categories_and_jurisdictions(self):
        manifest = {
            "markets": [{"code": "US", "jurisdiction_codes": ["US"]}],
            "platforms": [
                {"key": "amazon", "name": "Amazon"},
                {"key": "ebay", "name": "eBay"},
            ],
            "categories": [
                {"code": "electronics", "name": "电子产品"},
                {"code": "beauty", "name": "美妆个护"},
            ],
            "jurisdictions": [
                {"code": "US", "name": "美国联邦辖区"},
                {"code": "CA", "name": "加州"},
            ],
            "market_platforms": [
                {"market_code": "US", "platform_key": "amazon"},
            ],
        }
        record = {
            "id": "policy-matrix-1",
            "title": "Matrix policy",
            "market": "US",
            "platform_keys": ["amazon", "ebay"],
            "category_codes": ["electronics", "beauty"],
            "jurisdiction_codes": ["US", "CA"],
            "source_kind": "official",
            "source_type": "government",
            "source_url": "https://example.gov/records/matrix-policy",
            "source_record_id": "matrix-policy",
            "verification_status": "verified",
            "collected_at": "2026-08-30T00:00:00+00:00",
            "published_at": "2026-08-29",
        }
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as handle:
            json.dump(manifest, handle)
            manifest_path = handle.name
        try:
            with patch.object(sync_to_supabase, "MARKET_SCOPE_PATH", manifest_path), \
                    patch.object(sync_to_supabase, "iter_provenance_records", return_value=[("policies", "policy", record, 0)]):
                rows = sync_to_supabase.build_applicability_rows({"datasets": {}})
            self.assertEqual(len(rows), 4)
            self.assertEqual({row["platform_key"] for row in rows}, {"amazon"})
            self.assertEqual({row["category_code"] for row in rows}, {"electronics", "beauty"})
            self.assertEqual({row["jurisdiction_code"] for row in rows}, {"US", "CA"})
        finally:
            os.unlink(manifest_path)

    def test_rule_versions_use_explicit_versioned_record_keys(self):
        manifest = {
            "markets": [{"code": "US", "jurisdiction_codes": ["US"]}],
            "platforms": [{"key": "amazon", "name": "Amazon"}],
            "categories": [],
            "jurisdictions": [{"code": "US", "name": "美国联邦辖区"}],
            "market_platforms": [{"market_code": "US", "platform_key": "amazon"}],
        }
        record = {
            "id": "rule-version-1",
            "title": "Versioned platform rule",
            "market": "US",
            "platform": "Amazon",
            "source_kind": "traceable",
            "source_type": "platform",
            "source_url": "https://sellercentral.amazon.com/records/versioned-rule",
            "source_record_id": "versioned-rule",
            "verification_status": "verified",
            "collected_at": "2026-08-30T00:00:00+00:00",
            "published_at": "2026-08-29",
            "rule_version": "2026.08",
        }
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as handle:
            json.dump(manifest, handle)
            manifest_path = handle.name
        try:
            with patch.object(sync_to_supabase, "MARKET_SCOPE_PATH", manifest_path), \
                    patch.object(sync_to_supabase, "iter_provenance_records", return_value=[("rules", "rule", record, 0)]):
                rows = sync_to_supabase.build_applicability_rows({"datasets": {}})
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["record_version"], "2026.08")
            self.assertEqual(rows[0]["record_key"], "rule-version-1@2026.08")
        finally:
            os.unlink(manifest_path)

    def test_regulatory_change_metadata_is_projected_without_merging_domains(self):
        manifest = {
            "markets": [{"code": "US", "jurisdiction_codes": ["US"]}],
            "platforms": [], "categories": [],
            "jurisdictions": [{"code": "US", "name": "美国联邦辖区"}],
            "market_platforms": [],
        }
        record = {
            "id": "tax-change-1", "title": "Sales tax update", "title_zh": "销售税调整",
            "summary": "Updated collection threshold.", "summary_zh": "更新代扣起征点。",
            "translation": {"status": "translated", "source_hash": "test"},
            "market": "US", "tax_type": "sales_tax", "change_type": "rate_change",
            "change_summary": "threshold updated", "version": "2026.09",
            "source_kind": "official", "source_type": "government",
            "source_url": "https://example.gov/records/tax-change-1",
            "source_record_id": "tax-change-1", "verification_status": "verified",
            "collected_at": "2026-08-30T00:00:00+00:00", "published_at": "2026-08-29",
        }
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as handle:
            json.dump(manifest, handle)
            manifest_path = handle.name
        try:
            with patch.object(sync_to_supabase, "MARKET_SCOPE_PATH", manifest_path), \
                    patch.object(sync_to_supabase, "iter_provenance_records", return_value=[("taxes", "tax", record, 0)]):
                rows = sync_to_supabase.build_applicability_rows({"datasets": {}})
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["domain"], "tax")
            self.assertEqual(rows[0]["change_type"], "rate_change")
            self.assertEqual(rows[0]["record_version"], "2026.09")
            self.assertEqual(rows[0]["translation_status"], "translated")
            self.assertEqual(rows[0]["locale"], "zh-CN")
        finally:
            os.unlink(manifest_path)


if __name__ == "__main__":
    unittest.main()
