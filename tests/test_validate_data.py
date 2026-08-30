import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from validate_data import (  # noqa: E402
    DatasetResult,
    count_scoped_items,
    normalize_platform,
    valid_http_url,
    validate_all,
    validate_items_dataset,
)


class ValidateDataTests(unittest.TestCase):
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

    def test_quality_report_exposes_raw_and_current_scope_totals(self):
        report = validate_all(datetime(2026, 8, 28, tzinfo=timezone.utc))
        raw_total = sum(item["raw_records"] for item in report["datasets"].values())
        scoped_total = sum(item["scoped_records"] for item in report["datasets"].values())
        self.assertEqual(report["summary"]["raw_records"], raw_total)
        self.assertEqual(report["summary"]["scoped_records"], scoped_total)
        self.assertEqual(report["datasets"]["countries"]["scoped_records"], 1)
        self.assertEqual(report["datasets"]["platforms"]["scoped_records"], 4)
        self.assertLess(report["datasets"]["rules"]["scoped_records"], report["datasets"]["rules"]["raw_records"])


if __name__ == "__main__":
    unittest.main()
