import json
import json
import os
import sys
import tempfile
import unittest
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import collect_cpsc  # noqa: E402
import collect_data  # noqa: E402
from quarantine_unverified_baseline import is_unverified  # noqa: E402


class CollectorTests(unittest.TestCase):
    def test_query_url_encodes_unicode_spaces_and_repeated_fields(self):
        url = collect_data.build_query_url(
            "https://example.test/search?existing=1",
            [("q", "美国 电商"), ("fields[]", "title"), ("fields[]", "abstract")],
        )
        self.assertNotIn("美国", url)
        self.assertNotIn(" ", url)
        self.assertEqual(parse_qs(urlsplit(url).query), {
            "existing": ["1"],
            "q": ["美国 电商"],
            "fields[]": ["title", "abstract"],
        })

    def test_configured_collection_scope_excludes_schema_only_markets(self):
        scope = collect_data.configured_collection_scope({
            "config_version": "test",
            "markets": [
                {"code": "US", "status": "active", "data_status": "configured"},
                {"code": "ID", "status": "active", "data_status": "schema_only"},
            ],
            "platforms": [
                {"key": "amazon", "name": "Amazon"},
                {"key": "shopee", "name": "Shopee"},
            ],
            "market_platforms": [
                {"market_code": "US", "platform_key": "amazon", "status": "active", "data_status": "configured"},
                {"market_code": "ID", "platform_key": "shopee", "status": "active", "data_status": "schema_only"},
            ],
        })
        self.assertEqual(scope["market_codes"], ["US"])
        self.assertEqual(scope["platform_keys"], ["amazon"])
        self.assertEqual(scope["platform_names"], ["Amazon"])

    def test_core_source_http_failure_is_retained_in_collection_report(self):
        collect_data.reset_collection_telemetry({"market_codes": ["US"]})
        url = collect_data.build_query_url(
            "https://example.test/search", {"q": "美国 电商"}
        )
        with patch.object(collect_data, "urlopen", side_effect=RuntimeError("offline")):
            result = collect_data.fetch_json(
                url,
                source_key="official_policy",
                source_label="Official policy source",
                domain="policy",
                core=True,
                market_codes=["US"],
            )
        report = collect_data.build_collection_report()
        self.assertIsNone(result)
        self.assertEqual(report["status"], "failed")
        self.assertEqual(report["summary"]["core_failures"], ["official_policy"])
        source = report["sources"][0]
        self.assertEqual(source["status"], "failed")
        self.assertEqual(source["request_count"], 1)
        self.assertEqual(source["failed_requests"], 1)
        self.assertGreaterEqual(source["duration_ms"], 0)

    def test_main_uses_only_configured_scope_and_skips_legacy_global_writes(self):
        manifest = {
            "config_version": "test",
            "markets": [
                {"code": "US", "status": "active", "data_status": "configured"},
                {"code": "ID", "status": "active", "data_status": "schema_only"},
            ],
            "platforms": [
                {"key": "amazon", "name": "Amazon"},
                {"key": "tiktok-shop", "name": "TikTok Shop"},
                {"key": "aliexpress", "name": "AliExpress"},
                {"key": "ebay", "name": "eBay"},
                {"key": "shopee", "name": "Shopee"},
            ],
            "market_platforms": [
                {"market_code": "US", "platform_key": key, "status": "active", "data_status": "configured"}
                for key in ("amazon", "tiktok-shop", "aliexpress", "ebay")
            ] + [
                {"market_code": "ID", "platform_key": "shopee", "status": "active", "data_status": "schema_only"}
            ],
        }
        policy = {
            "id": "policy-1", "title": "US policy", "source": "Federal Register",
            "summary": "Current policy summary.",
            "source_url": "https://www.federalregister.gov/documents/1",
            "published_at": collect_data.NOW_DATE,
        }
        with tempfile.TemporaryDirectory() as directory:
            with open(os.path.join(directory, "market_scope.json"), "w", encoding="utf-8") as handle:
                json.dump(manifest, handle)
            with patch.object(collect_data, "DATA_DIR", directory), \
                    patch.object(collect_data, "collect_federal_register", return_value=[policy]), \
                    patch.object(collect_data, "collect_ustr", return_value=[]), \
                    patch.object(collect_data, "collect_cn_news", return_value=[]), \
                    patch.object(collect_data, "collect_amazon", return_value=[]), \
                    patch.object(collect_data, "collect_tiktok_shop", return_value=[]):
                self.assertEqual(collect_data.main(), 0)

            with open(os.path.join(directory, "collection_run.json"), encoding="utf-8") as handle:
                run = json.load(handle)
            with open(os.path.join(directory, "policies.json"), encoding="utf-8") as handle:
                policies = json.load(handle)
        self.assertEqual(run["scope"]["market_codes"], ["US"])
        self.assertEqual(
            run["scope"]["platform_keys"],
            ["amazon", "tiktok-shop", "aliexpress", "ebay"],
        )
        self.assertFalse(run["legacy_global_writes"])
        self.assertNotIn("shopee", run["scope"]["platform_keys"])
        self.assertEqual(policies["items"][0]["market_codes"], ["US"])
        self.assertFalse(hasattr(collect_data, "collect_platform_updates"))
        self.assertFalse(hasattr(collect_data, "collect_country_updates"))

    def test_industry_advisory_is_traceable_but_not_official(self):
        item = collect_data.annotate_industry_advisory({
            "title": "美国站新关税提醒",
            "summary": "美国跨境卖家需要关注进口费用变化。",
            "source": "雨果网",
            "source_url": "https://www.cifnews.com/article/123456",
            "region": "Global",
            "published_at": "2026-08-30",
        })
        self.assertEqual(item["source_kind"], "traceable")
        self.assertEqual(item["source_type"], "licensed_provider")
        self.assertEqual(item["source_class"], "industry_advisory")
        self.assertEqual(item["verification_status"], "pending")
        self.assertEqual(item["market_codes"], ["US"])
        self.assertNotIn("verified_at", item)

    def test_industry_market_detection_does_not_assume_global_scope(self):
        self.assertEqual(
            collect_data.infer_industry_market_codes("美国关税变化"),
            ["US"],
        )
        self.assertEqual(
            collect_data.infer_industry_market_codes("全球跨境电商趋势"),
            [],
        )
        record = {"title": "平台费用变化", "summary": "美国站卖家需要关注。"}
        collect_data.refresh_industry_market_scope(record)
        self.assertEqual(record["market_codes"], ["US"])
        self.assertEqual(record["market_scope_status"], "identified")

    def test_industry_market_detection_ignores_lowercase_url_parameter_codes(self):
        text = (
            "Worldfirst注册教程 "
            "https://example.com/?affiliate_id=8053&referral_id=8053"
        )
        self.assertEqual(collect_data.infer_industry_market_codes(text), [])

    def test_industry_market_detection_uses_future_market_aliases(self):
        with tempfile.TemporaryDirectory() as directory:
            with open(os.path.join(directory, "market_scope.json"), "w", encoding="utf-8") as handle:
                json.dump({
                    "markets": [
                        {
                            "code": "DE", "key": "de", "name": "德国", "label": "德国市场",
                            "aliases": ["germany"], "region_code": "EU", "region_name": "欧洲",
                        },
                        {
                            "code": "US", "key": "us", "name": "美国", "label": "美国市场",
                            "aliases": ["united states"], "region_code": "NA", "region_name": "北美",
                        },
                    ]
                }, handle, ensure_ascii=False)
            with patch.object(collect_data, "DATA_DIR", directory):
                self.assertEqual(
                    collect_data.infer_industry_market_codes("德国卖家平台费用调整"),
                    ["DE"],
                )
                self.assertEqual(
                    collect_data.infer_industry_market_codes("欧盟跨境电商进口要求"),
                    ["DE"],
                )
                record = {"market_codes": ["德国"], "title": "平台规则变化"}
                collect_data.refresh_industry_market_scope(record)
                self.assertEqual(record["market_codes"], ["DE"])
                record = {"market_codes": ["EU"], "title": "平台规则变化"}
                collect_data.refresh_industry_market_scope(record)
                self.assertEqual(record["market_codes"], ["EU", "DE"])

    def test_cn_news_keeps_both_providers_as_advisory_records(self):
        cifnews_html = (
            '<a href="https://www.cifnews.com/article/1">美国跨境电商关税新规提醒</a>'
        )
        amz123_html = '<a href="/t/2">美国 FBA 费用调整</a>'
        with patch.object(collect_data, "fetch_html", side_effect=[cifnews_html, amz123_html]):
            items = collect_data.collect_cn_news()
        self.assertEqual([item["source"] for item in items], ["雨果网", "AMZ123"])
        self.assertTrue(all(item["source_class"] == "industry_advisory" for item in items))
        self.assertTrue(all(item["verification_status"] == "pending" for item in items))
        self.assertTrue(all(item["market_codes"] == ["US"] for item in items))

    def test_cn_news_reads_absolute_amz123_links_with_nested_titles(self):
        cifnews_html = ''
        amz123_html = (
            '<a href="https://www.amz123.com/t/2" class="amz-container">'
            '<img alt="图标"><span>美国 FBA 费用调整</span></a>'
        )
        with patch.object(collect_data, "fetch_html", side_effect=[cifnews_html, amz123_html]):
            items = collect_data.collect_cn_news()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["source"], "AMZ123")
        self.assertEqual(items[0]["source_url"], "https://www.amz123.com/t/2")
        self.assertEqual(items[0]["market_codes"], ["US"])

    def test_cpsc_normalizes_official_fields_and_links(self):
        raw = [{
            "RecallID": 1,
            "RecallNumber": "R-1",
            "RecallDate": "2026-08-20T00:00:00",
            "Title": "Portable charger recall",
            "Description": "The battery can overheat.",
            "URL": "https:/www.cpsc.gov/Recalls/2026/example",
            "ManufacturerCountries": [{"Country": "China"}],
            "Products": [{"Name": "Portable charger"}],
            "Hazards": [{"Name": "Fire hazard"}],
        }]
        output = collect_cpsc.process_recalls(raw, days=120)
        self.assertEqual(output["meta"]["total_recalls"], 1)
        item = output["recalls"][0]
        self.assertEqual(item["id"], "cpsc-e55b177f")
        self.assertEqual(item["url"], "https://www.cpsc.gov/Recalls/2026/example")
        self.assertEqual(item["manufacturer_countries"], ["China"])
        self.assertTrue(item["china_related"])

    def test_unverified_baseline_requires_source_evidence(self):
        self.assertTrue(is_unverified({"title": "Sample", "data_quality": "demonstration"}))
        self.assertTrue(is_unverified({"title": "Sample", "source_verified": False}))
        self.assertTrue(is_unverified({"title": "Sample", "source_url": ""}))
        self.assertFalse(is_unverified({"title": "Real", "source_url": "https://example.gov/rule"}))


if __name__ == "__main__":
    unittest.main()
