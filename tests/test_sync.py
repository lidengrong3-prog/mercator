import json
import os
import inspect
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import sync_to_supabase  # noqa: E402


class SyncTests(unittest.TestCase):
    def test_full_sync_registers_catalogs_before_applicability_rows(self):
        source = inspect.getsource(sync_to_supabase.main)
        catalog_at = source.index('[SYNC] Processing market scope catalog')
        provenance_at = source.index('[SYNC] Processing source registry and raw evidence')
        applicability_at = source.index('market_data_applicability: {len(applicability_rows)}')
        public_bundle_at = source.index('[SYNC] Processing public market_data bundle')
        self.assertLess(catalog_at, provenance_at)
        self.assertLess(provenance_at, applicability_at)
        self.assertLess(applicability_at, public_bundle_at)

        catalog_tables = list(sync_to_supabase.build_catalog_rows())
        self.assertLess(catalog_tables.index("market_catalog"), catalog_tables.index("market_platforms"))
        self.assertLess(catalog_tables.index("platform_catalog"), catalog_tables.index("market_platforms"))
        self.assertLess(catalog_tables.index("category_profiles"), catalog_tables.index("report_template_catalog"))

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

    def test_sync_refuses_to_publish_without_collection_run_metadata(self):
        report = {"status": "healthy", "publishable": True, "datasets": {}}
        with patch.object(sync_to_supabase, "validate_all", return_value=report), \
                patch.object(sync_to_supabase, "write_report"), \
                patch.object(sync_to_supabase.sys, "argv", ["sync_to_supabase.py", "--dry-run"]):
            self.assertEqual(sync_to_supabase.main(), 3)

    def test_sync_refuses_to_publish_when_pipeline_sources_are_missing(self):
        report = {
            "status": "healthy", "publishable": True, "datasets": {},
            "collection_run": {
                "missing_pipeline_sources": ["cpsc_recalls"],
                "core_failures": [],
            },
        }
        with patch.object(sync_to_supabase, "validate_all", return_value=report), \
                patch.object(sync_to_supabase, "write_report"), \
                patch.object(sync_to_supabase.sys, "argv", ["sync_to_supabase.py", "--dry-run"]):
            self.assertEqual(sync_to_supabase.main(), 3)

    def test_raw_provenance_rows_keep_source_and_evidence_fields(self):
        rows = sync_to_supabase.build_raw_record_rows({"datasets": {}})
        self.assertGreater(len(rows), 0)
        self.assertTrue(all(row["source_key"] for row in rows))
        self.assertTrue(all(row["source_record_id"] for row in rows))
        self.assertTrue(all(row["evidence_hash"] for row in rows))
        self.assertTrue(all(row["verification_status"] in {"verified", "uploaded", "pending", "rejected"} for row in rows))
        self.assertTrue({"policies", "taxes", "access_requirements", "rules", "alerts"}.issubset(set(sync_to_supabase.PROVENANCE_DATASETS)))
        self.assertTrue({"macro", "cpsc"}.issubset(set(sync_to_supabase.PROVENANCE_DATASETS)))
        self.assertIn("retrieved_at", rows[0])

    def test_private_provenance_inputs_are_loaded_after_worker_restore(self):
        generated_at = "2026-09-15T00:00:00+00:00"
        with tempfile.TemporaryDirectory() as directory:
            us_market = os.path.join(directory, "us_market")
            os.makedirs(us_market)
            with open(os.path.join(us_market, "macro_indicators.json"), "w", encoding="utf-8") as handle:
                json.dump({
                    "meta": {"generated_at": generated_at},
                    "indicators": {"gdp": {"id": "GDP", "value": 1}},
                }, handle)
            with open(os.path.join(us_market, "cpsc_recalls.json"), "w", encoding="utf-8") as handle:
                json.dump({
                    "meta": {"generated_at": generated_at},
                    "recalls": [{"id": "cpsc-test-1", "title": "Test recall"}],
                }, handle)

            with patch.object(sync_to_supabase, "DATA_DIR", directory):
                records = list(sync_to_supabase.iter_provenance_records())

        self.assertEqual({key for key, _, _, _ in records}, {"macro", "cpsc"})
        self.assertTrue(all(record.get("market") == "US" for _, _, record, _ in records))
        self.assertTrue(all(record.get("collected_at") == generated_at for _, _, record, _ in records))

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
        rules = sync_to_supabase.load_json(os.path.join(sync_to_supabase.DATA_DIR, "rules.json"))
        public_rules = sync_to_supabase.public_market_data_payload("rules", rules).get("items", [])
        self.assertGreater(len(public_rules), 0)
        self.assertEqual(sum(row["domain"] == "rule" for row in rows), len(public_rules))

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

    def test_out_of_scope_platform_and_category_never_enter_sync_layers(self):
        base = {
            "id": "scope-test", "title": "Scoped record", "market": "US",
            "source": "CPSC", "source_url": "https://www.cpsc.gov/record/scope-test",
            "source_kind": "official", "source_type": "regulator",
            "source_record_id": "scope-test", "verification_status": "verified",
            "published_at": "2026-09-01", "collected_at": "2026-09-02T00:00:00Z",
        }
        records = [
            ("policies", "policy", dict(base, id="bad-platform", platform_keys=["walmart"]), 0),
            ("policies", "policy", dict(base, id="bad-category", category_codes=["toys"]), 1),
        ]
        with patch.object(sync_to_supabase, "iter_provenance_records", return_value=records):
            self.assertEqual(sync_to_supabase.build_raw_record_rows({"datasets": {}}), [])
            self.assertEqual(sync_to_supabase.build_applicability_rows({"datasets": {}}), [])

    def test_public_policy_bundle_excludes_legacy_industry_articles(self):
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
        self.assertEqual(public["items"], [])
        self.assertNotIn("source_class", source["items"][0])

    def test_public_policy_bundle_excludes_declared_industry_scope(self):
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
        self.assertEqual(public["items"], [])

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

    def test_collector_comparison_states_map_to_formal_change_types(self):
        self.assertEqual(
            sync_to_supabase._applicability_change_type({"change_type": "initial_record"}),
            "created",
        )
        self.assertEqual(
            sync_to_supabase._applicability_change_type({"change_type": "source_snapshot_changed"}),
            "updated",
        )
        self.assertIsNone(
            sync_to_supabase._applicability_change_type({"change_type": "unchanged"})
        )
        self.assertEqual(
            sync_to_supabase._applicability_change_type({"change_type": "rate_change"}),
            "rate_change",
        )
        self.assertIsNone(
            sync_to_supabase._applicability_change_type({"change_type": "unsupported"})
        )


if __name__ == "__main__":
    unittest.main()
