import json
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import collect_cpsc  # noqa: E402
import collect_data  # noqa: E402
from quarantine_unverified_baseline import is_unverified  # noqa: E402


class CollectorTests(unittest.TestCase):
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
