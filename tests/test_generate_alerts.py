import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, "scripts")
import generate_alerts  # noqa: E402


class GenerateAlertsTests(unittest.TestCase):
    def test_untranslated_cpsc_records_do_not_enter_chinese_alert_ui(self):
        payload = {
            "china_related": [{
                "id": "cpsc-untranslated", "title": "English recall", "description": "English detail",
                "date": generate_alerts.TODAY, "category": "electronics",
            }]
        }
        with patch.object(generate_alerts, "load_json", return_value=payload):
            self.assertEqual(generate_alerts.generate_from_cpsc(), [])

    def test_merge_discards_retired_static_cards_and_demo_records(self):
        existing = [
            ["a13", "policy", "high", "旧静态预警", "美国", "-", "无来源", "2026-07-15", False],
            ["usm-old", "policy", "mid", "旧相关性逻辑", "美国", "Agency", "无关法规", "2026-08-20", False],
            ["cpsc-real", "policy", "high", "正式召回", "美国", "CPSC", "有来源记录", "2026-08-20", False,
             {"source": "CPSC", "source_record_id": "cpsc-real", "schema_version": "2.0", "display_locale": "zh-CN",
              "generator_version": "2026.09.01.2"}],
            {"id": "demo-1", "title": "演示预警", "source_kind": "demo"},
        ]

        merged = generate_alerts.merge_alerts(existing, [])

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0][0], "cpsc-real")

    def test_explicit_us_policy_change_uses_chinese_display_and_severity(self):
        record = {
            "id": "policy-change-1",
            "title": "Import requirement update",
            "title_zh": "进口要求更新",
            "summary": "New import requirement",
            "summary_zh": "新增进口要求",
            "region": "US",
            "impact_level": "medium",
            "change_type": "requirement_change",
            "published_at": generate_alerts.TODAY,
            "source_url": "https://www.federalregister.gov/documents/policy-change-1",
        }
        with patch.object(generate_alerts, "load_json", return_value={"items": [record]}):
            alerts = generate_alerts.generate_from_policies()

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["level"], "mid")
        self.assertEqual(alerts[0]["title"], "政策变更：进口要求更新")
        self.assertEqual(alerts[0]["detail"], "新增进口要求")
        self.assertEqual(alerts[0]["change_type"], "requirement_change")

    def test_global_policy_is_not_relabelled_as_us_alert(self):
        record = {
            "id": "global-policy-1",
            "title": "Global tariff update",
            "summary": "Global tariff update",
            "region": "Global",
            "impact_level": "high",
            "published_at": generate_alerts.TODAY,
        }
        with patch.object(generate_alerts, "load_json", return_value={"items": [record]}):
            self.assertEqual(generate_alerts.generate_from_policies(), [])

    def test_industry_specific_trade_notice_is_not_a_cross_border_alert(self):
        record = {
            "id": "steel-review-1",
            "title": "Steel wire rod antidumping duty review",
            "title_zh": "钢丝反倾销税审查",
            "summary": "Administrative review for steel producers",
            "summary_zh": "钢铁生产商行政审查",
            "region": "US",
            "impact_level": "high",
            "published_at": generate_alerts.TODAY,
            "source_url": "https://www.federalregister.gov/documents/steel-review-1",
        }
        with patch.object(generate_alerts, "load_json", return_value={"items": [record]}):
            self.assertEqual(generate_alerts.generate_from_policies(), [])

    def test_third_party_industry_article_never_generates_automatic_alert(self):
        record = {
            "id": "industry-us-1",
            "title": "美国关税重大调整",
            "summary": "美国进口费用发生变化。",
            "region": "US",
            "impact_level": "high",
            "published_at": generate_alerts.TODAY,
            "source": "雨果网",
            "source_url": "https://www.cifnews.com/article/industry-us-1",
        }
        with patch.object(generate_alerts, "load_json", return_value={"items": [record]}):
            self.assertEqual(generate_alerts.generate_from_policies(), [])


if __name__ == "__main__":
    unittest.main()
