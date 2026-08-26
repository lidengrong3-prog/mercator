import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from validate_data import DatasetResult, valid_http_url, validate_items_dataset  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
