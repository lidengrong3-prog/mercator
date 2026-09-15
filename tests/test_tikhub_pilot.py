import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import collect_tikhub_pilot as pilot  # noqa: E402


def fixture_payload():
    return {
        "product_search": {"items": [
            {"product_id": "p-1", "title": "One", "price": "12.50", "currency": "USD"},
            {"title": "Missing ID"},
        ]},
        "product_detail": {"data": {"product_id": "p-1", "title": "One", "price": "13"}},
        "seller_profile": {"seller_id": "s-1", "seller_name": "Seller", "followers": 10},
        "shop_analytics": {"shop_id": "s-1", "gmv": 100, "sales": 3},
    }


class TikHubPilotTests(unittest.TestCase):
    def with_fixture(self, payload=None, **kwargs):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tikhub.json"
            path.write_text(json.dumps(payload or fixture_payload()), encoding="utf-8")
            return pilot.collect_pilot(fixture_path=str(path), dry_run=True, **kwargs)

    def test_scope_and_default_keywords_are_fixed(self):
        self.assertEqual(len(pilot.validate_keywords()), 20)
        self.assertEqual(len(set(pilot.validate_keywords())), 20)
        with self.assertRaises(pilot.TikHubPilotError):
            pilot.validate_keywords(["duplicate", "duplicate"])
        with self.assertRaises(pilot.TikHubPilotError):
            pilot.validate_keywords(["one"])

    def test_fixture_accounts_all_four_endpoints_and_quarantines_source(self):
        result = self.with_fixture(run_date="2026-09-14")
        self.assertEqual(result["market_code"], "US")
        self.assertEqual(result["platform_key"], "tiktok-shop")
        self.assertEqual(result["keyword_count"], 20)
        self.assertEqual(result["request_count"], 80)
        self.assertEqual(result["successful_requests"], 80)
        self.assertEqual(result["status"], "succeeded")
        self.assertEqual(result["report"]["authorization_summary"]["source_kind"], "traceable")
        self.assertFalse(result["report"]["authorization_summary"]["public_display_allowed"])
        self.assertGreaterEqual(result["missing_count"], 1)
        self.assertGreaterEqual(result["duplicate_count"], 1)

    def test_keyword_monitor_uses_one_keyword_and_four_requests(self):
        result = self.with_fixture(
            run_date="2026-09-14", keywords=["skincare"], market_code="US",
            platform_key="tiktok-shop", monitoring=True, monitoring_type="keyword",
            monitoring_task_id="00000000-0000-0000-0000-000000000010",
        )
        self.assertTrue(result["monitoring"])
        self.assertEqual(result["keyword_count"], 1)
        self.assertEqual(result["request_count"], 4)
        self.assertEqual(result["monitoring_task_id"], "00000000-0000-0000-0000-000000000010")

    def test_product_and_shop_monitors_use_two_target_endpoints(self):
        product = self.with_fixture(
            run_date="2026-09-14", market_code="US", monitoring=True,
            monitoring_type="product", monitoring_task_id="00000000-0000-0000-0000-000000000011",
            target_external_id="p-1",
        )
        shop = self.with_fixture(
            run_date="2026-09-14", market_code="US", monitoring=True,
            monitoring_type="shop", monitoring_task_id="00000000-0000-0000-0000-000000000012",
            target_external_id="s-1",
        )
        self.assertEqual(product["request_count"], 2)
        self.assertEqual(shop["request_count"], 2)

    def test_content_normalization_preserves_creator_product_and_metrics(self):
        content = pilot.normalize_record({
            "video_id": "v-1", "description": "Demo", "creator_id": "u-1",
            "product_id": "p-1", "views": 100, "likes": 10, "comments": 2,
        }, "video_detail", "beauty", "US", "tiktok-shop")
        self.assertEqual(content["snapshot_type"], "content")
        self.assertEqual(content["platform_content_id"], "v-1")
        self.assertEqual(content["creator_id"], "u-1")
        self.assertEqual(content["product_id"], "p-1")
        self.assertEqual(content["views"], 100)

    def test_content_collection_writes_content_scope_without_product_shop_calls(self):
        payload = {
            "video_search": [{"video_id": "v-1", "description": "Demo", "creator_id": "u-1", "product_id": "p-1", "views": 10}],
            "video_detail": [{"video_id": "v-1", "views": 12, "likes": 3}],
            "creator_profile": [{"creator_id": "u-1", "followers": 100}],
            "video_product_relation": [{"video_id": "v-1", "product_id": "p-1", "shop_id": "s-1"}],
        }
        result = self.with_fixture(payload=payload, run_date="2026-09-14", content=True)
        self.assertEqual(result["pilot_key"], "tiktok-shop-us-content-pilot")
        self.assertEqual(result["request_count"], 80)
        self.assertGreaterEqual(result["content_trend_count"], 1)
        self.assertEqual(result["report"]["content_trend_count"], result["content_trend_count"])

    def test_shop_monitor_requires_target_and_pins_target_id(self):
        with self.assertRaisesRegex(pilot.TikHubPilotError, "requires a target ID"):
            self.with_fixture(
                market_code="US", monitoring=True, monitoring_type="shop",
                monitoring_task_id="00000000-0000-0000-0000-000000000010",
            )
        params = pilot._endpoint_parameters(
            "shop_analytics", "shop-1", "US", "tiktok-shop",
            monitoring_type="shop", target_external_id="shop-1",
        )
        self.assertEqual(params["shop_id"], "shop-1")
        self.assertEqual(params["market"], "US")

    def test_stable_ids_and_snapshot_ids_are_deterministic(self):
        product = pilot.normalize_record({"product_id": "p-1", "price": 10}, "product_search", "beauty")
        first = pilot._history_rows(product, "raw-a", "a" * 64, "2026-09-14T00:00:00+00:00")
        second = pilot._history_rows(product, "raw-b", "b" * 64, "2026-09-15T00:00:00+00:00")
        self.assertEqual(first[0]["id"], second[0]["id"])
        self.assertNotEqual(first[1]["id"], second[1]["id"])
        self.assertEqual(first[1]["evidence_hash"], "a" * 64)

    def test_cookie_endpoint_requires_explicit_opt_in_and_secret(self):
        with patch.dict(os.environ, {
            "TIKHUB_ENDPOINT_PRODUCT_SEARCH": "https://api.tikhub.io/products",
            "TIKHUB_ENDPOINT_PRODUCT_SEARCH_REQUIRES_COOKIE": "true",
            "TIKHUB_ALLOW_COOKIE_ENDPOINTS": "false",
        }, clear=False):
            with self.assertRaises(pilot.TikHubPilotError):
                pilot.resolve_endpoint("product_search")
        with patch.dict(os.environ, {
            "TIKHUB_ENDPOINT_PRODUCT_SEARCH": "https://api.tikhub.io/products",
            "TIKHUB_ENDPOINT_PRODUCT_SEARCH_REQUIRES_COOKIE": "true",
            "TIKHUB_ALLOW_COOKIE_ENDPOINTS": "true",
            "TIKHUB_COOKIE_SECRET": "cookie-secret",
            "TIKHUB_ENDPOINT_PRODUCT_SEARCH_PRODUCTION_AUTOMATION_ALLOWED": "true",
        }, clear=False):
            config = pilot.resolve_endpoint("product_search")
            self.assertTrue(config["requires_cookie"])

    def test_endpoint_rejects_http_unknown_hosts_and_query_credentials(self):
        for value in (
            "http://api.tikhub.io/products",
            "https://evil.example/products",
            "https://api.tikhub.io/products?token=secret",
        ):
            with patch.dict(os.environ, {"TIKHUB_ENDPOINT_PRODUCT_SEARCH": value}, clear=False):
                with self.assertRaises(pilot.TikHubPilotError):
                    pilot.resolve_endpoint("product_search")

    def test_network_run_requires_worker_secret_and_explicit_enablement(self):
        saved = {name: os.environ.get(name) for name in ("TIKHUB_API_KEY", "TIKHUB_PILOT_ENABLED")}
        try:
            os.environ.pop("TIKHUB_API_KEY", None)
            os.environ["TIKHUB_PILOT_ENABLED"] = "true"
            with self.assertRaisesRegex(pilot.TikHubPilotError, "TIKHUB_API_KEY"):
                pilot.collect_pilot()
        finally:
            for name, value in saved.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value

    def test_seven_day_report_is_incomplete_until_seven_distinct_days(self):
        runs = [{
            "run_date": f"2026-09-{day:02d}", "request_count": 80,
            "successful_requests": 79, "records_collected": 10,
            "missing_count": 1, "duplicate_count": 2,
            "estimated_cost_usd": 4, "report": {"product_trend_count": 2, "shop_trend_count": 1},
        } for day in range(8, 15)]
        report = pilot.build_seven_day_report(runs, [])
        self.assertEqual(report["status"], "complete")
        self.assertEqual(report["total_requests"], 560)
        self.assertEqual(report["total_cost_usd"], 28)
        self.assertEqual(len(report["coverage"]["run_days"]), 7)


if __name__ == "__main__":
    unittest.main()
