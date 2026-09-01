import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from validate_data import (  # noqa: E402
    CPSC_MAX_AGE_HOURS,
    DatasetResult,
    count_scoped_items,
    is_scope_market,
    normalize_platform,
    normalize_source_kind,
    effective_source_type,
    has_current_chinese_display,
    normalize_verification_status,
    record_quality,
    valid_http_url,
    validate_all,
    validate_items_dataset,
    regulatory_source_hash,
)


class ValidateDataTests(unittest.TestCase):
    def test_cpsc_freshness_window_covers_weekends(self):
        self.assertEqual(CPSC_MAX_AGE_HOURS, 72)

    def test_http_source_urls_require_a_real_host(self):
        self.assertTrue(valid_http_url("https://www.federalregister.gov/documents/1"))
        self.assertFalse(valid_http_url("javascript:alert(1)"))
        self.assertFalse(valid_http_url("https:///missing-host"))
        self.assertFalse(valid_http_url(""))

    def test_stale_only_dataset_has_stale_status(self):
        result = DatasetResult("policies", "data/policies.json")
        result.errors.append("超过新鲜度阈值：48.0 小时 > 36 小时")
        self.assertEqual(result.status, "stale")

    def test_item_validator_rejects_duplicate_ids_and_future_collection(self):
        now = datetime(2026, 8, 25, tzinfo=timezone.utc)
        payload = {
            "updated_at": now.isoformat(),
            "items": [
                {
                    "id": "same-id",
                    "title": "Policy A",
                    "source": "Official source",
                    "source_url": "https://example.gov/a",
                    "published_at": "2026-08-24",
                    "collected_at": now.isoformat(),
                },
                {
                    "id": "same-id",
                    "title": "Policy B",
                    "source": "Official source",
                    "source_url": "not-a-url",
                    "published_at": "2026-08-24",
                    "collected_at": (now + timedelta(days=3)).isoformat(),
                },
            ],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, "items.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle)
            result = validate_items_dataset(
                "policies", path, now, minimum=1, max_age_hours=36
            )
        self.assertTrue(any("重复 ID" in error for error in result.errors))
        self.assertTrue(any("异常未来日期" in error for error in result.errors))
        self.assertTrue(any("来源 URL" in warning for warning in result.warnings))

    def test_current_scope_normalizes_only_the_four_configured_platforms(self):
        self.assertEqual(normalize_platform("AliExpress 速卖通"), "AliExpress")
        self.assertEqual(normalize_platform("TikTok Shop US"), "TikTok Shop")
        rows = [
            {"platform": "Amazon", "market": "US"},
            {"platform": "TikTok Shop", "market": "US"},
            {"platform": "Amazon", "market": "Global"},
            {"platform": "Shopee", "market": "US"},
        ]
        self.assertEqual(count_scoped_items("rules", rows), 2)

    def test_scope_manifest_is_used_for_market_matching(self):
        self.assertTrue(is_scope_market("US"))
        self.assertTrue(is_scope_market("美国"))
        self.assertFalse(is_scope_market("Global"))

    def test_provenance_gate_excludes_demo_and_pending_records(self):
        verified = {
            "id": "p-1", "title": "US policy", "market": "US",
            "source_kind": "official", "source_type": "government",
            "source_url": "https://example.gov/records/p-1",
            "published_at": "2026-08-28", "collected_at": "2026-08-28T12:00:00+00:00",
            "verification_status": "verified",
        }
        demo = dict(verified, source_kind="demo", data_quality="demonstration")
        pending = dict(verified, verification_status="pending")
        self.assertTrue(record_quality(verified)["formal"])
        self.assertFalse(record_quality(demo)["formal"])
        self.assertIn("demo", record_quality(demo)["reasons"])
        self.assertFalse(record_quality(pending)["formal"])
        self.assertIn("unverified", record_quality(pending)["reasons"])

    def test_provenance_labels_are_normalized_without_unknown_fallback(self):
        self.assertEqual(normalize_source_kind("官方"), "official")
        self.assertEqual(normalize_source_kind("mock"), "demo")
        self.assertEqual(normalize_source_kind("not-a-source"), "")
        self.assertEqual(normalize_verification_status("待核验"), "pending")
        self.assertEqual(normalize_verification_status("unknown"), "")

    def test_effective_source_type_reports_legacy_rows_without_claiming_missing_urls(self):
        legacy = {
            "source": "Industry feed",
            "source_url": "https://feed.example.test/record-1",
            "published_at": "2026-08-29",
            "collected_at": "2026-08-30T00:00:00+00:00",
        }
        self.assertEqual(effective_source_type(legacy, "traceable"), "licensed_provider")
        invalid = dict(legacy, source_url="not-a-url")
        self.assertEqual(effective_source_type(invalid, "traceable"), "unknown")

    def test_quality_report_exposes_raw_and_current_scope_totals(self):
        report = validate_all(datetime(2026, 8, 28, tzinfo=timezone.utc))
        raw_total = sum(item["raw_records"] for item in report["datasets"].values())
        scoped_total = sum(item["scoped_records"] for item in report["datasets"].values())
        self.assertEqual(report["summary"]["raw_records"], raw_total)
        self.assertEqual(report["summary"]["scoped_records"], scoped_total)
        self.assertIn("formal_records", report["summary"])
        self.assertIn("excluded_records", report["summary"])
        self.assertIn("effective_to", report["provenance_fields"])
        self.assertIn("formal_records", report["datasets"]["policies"])
        self.assertGreaterEqual(report["summary"]["raw_records"], report["summary"]["formal_records"])
        self.assertEqual(report["datasets"]["countries"]["scoped_records"], 1)
        self.assertEqual(report["datasets"]["platforms"]["scoped_records"], 4)
        self.assertLess(report["datasets"]["rules"]["scoped_records"], report["datasets"]["rules"]["raw_records"])
        self.assertIn("taxes", report["datasets"])
        self.assertIn("access_requirements", report["datasets"])

    def test_regulatory_chinese_display_is_bound_to_source_text(self):
        record = {
            "title": "Import policy update", "summary": "New requirement.",
            "title_zh": "进口政策更新", "summary_zh": "新增要求。",
        }
        record["translation"] = {
            "status": "translated", "source_hash": regulatory_source_hash(record)
        }
        self.assertTrue(has_current_chinese_display(record))
        record["summary"] = "Changed source summary."
        self.assertFalse(has_current_chinese_display(record))

    def test_tax_domain_rejects_unknown_tax_types(self):
        now = datetime(2026, 8, 31, tzinfo=timezone.utc)
        payload = {
            "updated_at": now.isoformat(),
            "items": [{
                "id": "tax-1", "title": "Tax", "tax_type": "invented_tax",
                "source": "Official", "source_url": "https://example.gov/tax-1",
                "published_at": "2026-08-30", "collected_at": now.isoformat(),
            }],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            path = os.path.join(temp_dir, "taxes.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle)
            result = validate_items_dataset(
                "taxes", path, now, minimum=0, max_age_hours=168,
                type_field="tax_type", allowed_types={"sales_tax"},
            )
        self.assertTrue(any("tax_type" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
