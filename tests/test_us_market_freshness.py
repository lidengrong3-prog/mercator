import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import collect_us_market  # noqa: E402
import validate_data  # noqa: E402


NOW = datetime(2026, 9, 7, 4, 0, tzinfo=timezone.utc)
LATER = datetime(2026, 9, 7, 8, 0, tzinfo=timezone.utc)
OLD_TIME = "2026-09-01T01:00:00+00:00"


def old_category_payload():
    return {
        "meta": {
            "market": "美国消费电子 (US Consumer Electronics)",
            "cat_key": "electronics",
            "generated_at": OLD_TIME,
            "as_of": "2026-09-01",
            "last_checked_at": OLD_TIME,
            "sections": ["country", "platforms", "rules", "policies", "alerts"],
            "counts": {"country": 1, "platforms": 0, "rules": 0, "policies": 1, "alerts": 2},
        },
        "country": {"source": "reference"},
        "findings": [],
        "platforms": [],
        "matrix": [],
        "rules": [],
        "policies": [{"title": "Cached policy", "source": "Federal Register", "live": True}],
        "alerts": [
            {"title": "Tariff", "source": "USTR", "live": False},
            {"title": "Cached alert", "source": "Federal Register", "live": True},
        ],
    }


def telemetry(status, successful, failed):
    return {
        "source": "federal_register",
        "status": status,
        "attempted_at": NOW.isoformat(),
        "request_count": successful + failed,
        "successful_requests": successful,
        "failed_requests": failed,
        "records_collected": 0,
    }


class UsMarketFreshnessTests(unittest.TestCase):
    def test_collector_catalog_matches_market_scope_and_excludes_retired_platforms(self):
        manifest_categories = set(collect_us_market._US_SCOPE["category_keys"])
        self.assertEqual(set(collect_us_market.CATEGORIES), manifest_categories)
        self.assertIn("pet-food", manifest_categories)
        self.assertIn("pet-supplies", manifest_categories)

        retired = {"walmart", "etsy", "shopify", "temu", "shein"}
        for category in collect_us_market.CATEGORIES:
            payload = collect_us_market.collect_category(category, no_network=True)
            rendered = json.dumps(payload, ensure_ascii=False).casefold()
            self.assertFalse(any(platform in rendered for platform in retired))
            self.assertEqual(
                {row["platform_key"] for row in payload["platforms"]},
                set(collect_us_market._US_SCOPE["platform_keys"]),
            )

    def test_fetch_telemetry_distinguishes_partial_request_failure(self):
        response_count = len(collect_us_market.CATEGORIES["electronics"]["fr_terms"])
        responses = [{"results": []}] + [None] * (response_count - 1)
        with patch.object(collect_us_market, "utc_now", return_value=NOW), \
                patch.object(collect_us_market, "http_get_json", side_effect=responses):
            policies, alerts, run = collect_us_market.fetch_fr_policies("electronics")

        self.assertEqual(policies, [])
        self.assertEqual(alerts, [])
        self.assertEqual(run["status"], "degraded")
        self.assertEqual(run["request_count"], response_count)
        self.assertEqual(run["successful_requests"], 1)
        self.assertEqual(run["failed_requests"], response_count - 1)

    def test_cache_fallback_preserves_original_content_time(self):
        with tempfile.TemporaryDirectory() as directory:
            with open(os.path.join(directory, "electronics.json"), "w", encoding="utf-8") as handle:
                json.dump(old_category_payload(), handle)
            with patch.object(collect_us_market, "DATA_DIR", directory), \
                    patch.object(collect_us_market, "utc_now", return_value=NOW), \
                    patch.object(
                        collect_us_market,
                        "fetch_fr_policies",
                        return_value=([], [], telemetry("failed", 0, 5)),
                    ):
                output = collect_us_market.collect_category("electronics")

        self.assertEqual(output["meta"]["generated_at"], OLD_TIME)
        self.assertEqual(output["meta"]["content_updated_at"], OLD_TIME)
        self.assertEqual(output["meta"]["as_of"], "2026-09-01")
        self.assertEqual(output["meta"]["last_checked_at"], OLD_TIME)
        self.assertEqual(output["meta"]["last_attempted_at"], NOW.isoformat())
        self.assertEqual(output["meta"]["collection_status"], "failed")
        self.assertTrue(output["meta"]["cache_used"])
        self.assertEqual(output["policies"][0]["title"], "Cached policy")

    def test_partial_success_is_degraded_and_marks_cached_sections(self):
        fresh_policy = {
            "title": "Fresh policy", "source": "Federal Register", "live": True,
            "date": "2026-09-07", "collected_at": NOW.isoformat(),
        }
        with tempfile.TemporaryDirectory() as directory:
            with open(os.path.join(directory, "electronics.json"), "w", encoding="utf-8") as handle:
                json.dump(old_category_payload(), handle)
            with patch.object(collect_us_market, "DATA_DIR", directory), \
                    patch.object(collect_us_market, "utc_now", return_value=NOW), \
                    patch.object(
                        collect_us_market,
                        "fetch_fr_policies",
                        return_value=([fresh_policy], [], telemetry("degraded", 3, 2)),
                    ):
                output = collect_us_market.collect_category("electronics")

        self.assertEqual(output["meta"]["collection_status"], "degraded")
        self.assertEqual(output["meta"]["last_checked_at"], OLD_TIME)
        self.assertEqual(output["meta"]["cached_sections"], ["alerts"])
        self.assertTrue(output["meta"]["cache_used"])
        self.assertEqual(output["policies"][0]["title"], "Fresh policy")
        self.assertTrue(any(row.get("title") == "Cached alert" for row in output["alerts"]))

    def test_successful_unchanged_check_only_advances_last_checked_time(self):
        def fresh_policy(collected_at):
            return {
                "title": "Stable policy",
                "date": "2026-09-07",
                "source": "Federal Register",
                "source_url": "https://www.federalregister.gov/documents/stable",
                "as_of": "2026-09-07",
                "collected_at": collected_at,
                "live": True,
            }

        with tempfile.TemporaryDirectory() as directory:
            with patch.object(collect_us_market, "DATA_DIR", directory), \
                    patch.object(collect_us_market, "utc_now", return_value=NOW), \
                    patch.object(
                        collect_us_market,
                        "fetch_fr_policies",
                        return_value=([fresh_policy(NOW.isoformat())], [], telemetry("succeeded", 5, 0)),
                    ):
                first = collect_us_market.collect_category("electronics")
            with open(os.path.join(directory, "electronics.json"), "w", encoding="utf-8") as handle:
                json.dump(first, handle)

            later_run = telemetry("succeeded", 5, 0)
            later_run["attempted_at"] = LATER.isoformat()
            with patch.object(collect_us_market, "DATA_DIR", directory), \
                    patch.object(collect_us_market, "utc_now", return_value=LATER), \
                    patch.object(
                        collect_us_market,
                        "fetch_fr_policies",
                        return_value=([fresh_policy(LATER.isoformat())], [], later_run),
                    ):
                second = collect_us_market.collect_category("electronics")

        self.assertEqual(second["meta"]["generated_at"], first["meta"]["generated_at"])
        self.assertEqual(second["meta"]["content_updated_at"], first["meta"]["content_updated_at"])
        self.assertEqual(second["meta"]["last_checked_at"], LATER.isoformat())
        self.assertEqual(second["policies"][0]["collected_at"], NOW.isoformat())

    def test_full_failure_without_cache_is_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(collect_us_market, "DATA_DIR", directory), \
                    patch.object(collect_us_market, "utc_now", return_value=NOW), \
                    patch.object(
                        collect_us_market,
                        "fetch_fr_policies",
                        return_value=([], [], telemetry("failed", 0, 5)),
                    ):
                output = collect_us_market.collect_category("electronics")

        self.assertEqual(output["meta"]["collection_status"], "failed")
        self.assertFalse(output["meta"]["cache_used"])
        self.assertIsNone(output["meta"]["last_checked_at"])
        self.assertEqual(output["policies"], [])

    def test_quality_gate_blocks_failed_category_and_degrades_partial_category(self):
        with tempfile.TemporaryDirectory() as root_directory:
            directory = os.path.join(root_directory, "us_market")
            os.makedirs(directory)
            categories = []
            for index in range(8):
                key = "category-%d" % index
                status = "failed" if index == 0 else ("degraded" if index == 1 else "succeeded")
                filename = key + ".json"
                categories.append({"key": key, "file": filename, "collection_status": status})
                payload = {
                    "meta": {
                        "generated_at": NOW.isoformat(),
                        "content_updated_at": NOW.isoformat(),
                        "last_checked_at": NOW.isoformat() if status == "succeeded" else OLD_TIME,
                        "collection_status": status,
                        "cache_used": status != "succeeded",
                    },
                    "country": {}, "platforms": [], "rules": [], "policies": [], "alerts": [],
                }
                with open(os.path.join(directory, filename), "w", encoding="utf-8") as handle:
                    json.dump(payload, handle)
            with open(os.path.join(directory, "index.json"), "w", encoding="utf-8") as handle:
                json.dump({"generated_at": NOW.isoformat(), "categories": categories}, handle)

            with patch.object(validate_data, "DATA_DIR", root_directory):
                result = validate_data.validate_us_market(NOW)

        self.assertEqual(result.status, "failed")
        self.assertTrue(any("核心来源全量采集失败" in error for error in result.errors))
        self.assertTrue(any("部分请求失败" in warning for warning in result.warnings))
        self.assertEqual(result.metrics["collection_status_counts"]["failed"], 1)
        self.assertEqual(result.metrics["collection_status_counts"]["degraded"], 1)

    def test_quality_gate_blocks_no_network_rebuild(self):
        with tempfile.TemporaryDirectory() as root_directory:
            directory = os.path.join(root_directory, "us_market")
            os.makedirs(directory)
            categories = []
            for index in range(8):
                key = "category-%d" % index
                filename = key + ".json"
                categories.append({"key": key, "file": filename, "collection_status": "skipped"})
                payload = {
                    "meta": {
                        "generated_at": NOW.isoformat(),
                        "collection_status": "skipped",
                        "cache_used": True,
                    },
                    "country": {}, "platforms": [], "rules": [], "policies": [], "alerts": [],
                }
                with open(os.path.join(directory, filename), "w", encoding="utf-8") as handle:
                    json.dump(payload, handle)
            with open(os.path.join(directory, "index.json"), "w", encoding="utf-8") as handle:
                json.dump({"generated_at": NOW.isoformat(), "categories": categories}, handle)

            with patch.object(validate_data, "DATA_DIR", root_directory):
                result = validate_data.validate_us_market(NOW)

        self.assertEqual(result.status, "failed")
        self.assertTrue(any("禁止发布离线重建结果" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
