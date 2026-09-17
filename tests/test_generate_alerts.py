import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, "scripts")
import generate_alerts  # noqa: E402


def lineage_fields(record_ids=None, evidence_hashes=None, lineage_type="record", matched_count=None):
    record_ids = record_ids or ["source-1"]
    evidence_hashes = evidence_hashes or ["b" * 64]
    matched_count = len(record_ids) if matched_count is None else matched_count
    fields = {
        "lineage_type": lineage_type,
        "input_dataset": "data/test.json",
        "dataset_snapshot_id": "c" * 64,
        "dataset_snapshot_at": "2026-09-06T00:00:00Z",
        "dataset_record_count": max(3, matched_count),
        "window_start": "2026-06-08",
        "window_end": "2026-09-06",
        "input_record_count": max(3, matched_count),
        "matched_record_count": matched_count,
        "source_record_ids": record_ids,
        "upstream_evidence_hashes": evidence_hashes,
        "source_record_evidence": [
            {"source_record_id": record_id, "evidence_hash": evidence_hash}
            for record_id, evidence_hash in zip(record_ids, evidence_hashes)
        ],
    }
    if lineage_type == "aggregate":
        fields["aggregate_count"] = matched_count
    return fields


class GenerateAlertsTests(unittest.TestCase):
    def test_legacy_cpsc_category_is_normalized_to_catalog(self):
        records = [{
            "id": f"legacy-toy-{index}", "title": "Toy recall",
            "title_zh": f"玩具召回{index}", "description_zh": "产品存在安全风险",
            "date": generate_alerts.TODAY, "category": "toys",
        } for index in range(3)]
        with patch.object(generate_alerts, "load_json", return_value={"china_related": records}):
            alerts = generate_alerts.generate_from_cpsc()
        self.assertTrue(alerts)
        self.assertEqual({tuple(alert["category_codes"]) for alert in alerts}, {("generic",)})

    def test_untranslated_cpsc_records_do_not_enter_chinese_alert_ui(self):
        payload = {
            "china_related": [{
                "id": "cpsc-untranslated", "title": "English recall", "description": "English detail",
                "date": generate_alerts.TODAY, "category": "electronics",
            }]
        }
        with patch.object(generate_alerts, "load_json", return_value=payload):
            self.assertEqual(generate_alerts.generate_from_cpsc(), [])

    def test_cpsc_alert_carries_source_record_provenance(self):
        payload = {
            "china_related": [{
                "id": "cpsc-real", "title": "English recall", "description": "English detail",
                "title_zh": "英文召回", "description_zh": "产品存在安全风险",
                "date": "2026-09-06", "category": "electronics",
                "url": "https://www.cpsc.gov/Recalls/2026/cpsc-real",
                "source": "CPSC", "source_url": "https://www.cpsc.gov/Recalls/2026/cpsc-real",
                "source_record_id": "cpsc-real", "source_kind": "official", "source_type": "regulator",
                "verification_status": "verified", "published_at": "2026-09-06",
                "collected_at": "2026-09-06T00:00:00Z", "verified_at": "2026-09-06T00:00:00Z",
                "verification_notes": "已核验", "evidence_hash": "b" * 64,
            }]
        }
        with patch.object(generate_alerts, "load_json", return_value=payload):
            alerts = generate_alerts.generate_from_cpsc()
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["source_record_id"], "cpsc-real")
        self.assertEqual(alerts[0]["collected_at"], "2026-09-06T00:00:00Z")
        self.assertEqual(alerts[0]["verified_at"], "2026-09-06T00:00:00Z")

    def test_merge_discards_retired_static_cards_and_demo_records(self):
        existing = [
            ["a13", "policy", "high", "旧静态预警", "美国", "-", "无来源", "2026-07-15", False],
            ["usm-old", "policy", "mid", "旧相关性逻辑", "美国", "Agency", "无关法规", "2026-08-20", False],
            ["cpsc-real", "policy", "high", "正式召回", "美国", "CPSC", "有来源记录", "2026-08-20", False,
             {"source": "CPSC", "source_url": "https://www.cpsc.gov/Recalls/2026/cpsc-real",
              "source_kind": "derived", "source_type": "derived", "source_record_id": "cpsc-real",
              "verification_status": "verified", "published_at": "2026-08-20",
              "collected_at": "2026-08-21T00:00:00Z", "verified_at": "2026-08-21T00:00:00Z",
              "verification_notes": "已核验", "evidence_hash": "a" * 64,
              **lineage_fields(["cpsc-real"], ["a" * 64]),
              "schema_version": generate_alerts.ALERT_SCHEMA_VERSION, "display_locale": "zh-CN",
              "generator_version": generate_alerts.GENERATOR_VERSION}],
            {"id": "demo-1", "title": "演示预警", "source_kind": "demo"},
        ]

        merged = generate_alerts.merge_alerts(existing, [])

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0][0], "cpsc-real")

    def test_incomplete_existing_provenance_is_not_retained(self):
        existing = [[
            "old-incomplete", "policy", "high", "旧预警", "美国", "CPSC", "缺少采集时间", "2026-08-20", False,
            {"source": "CPSC", "source_url": "https://www.cpsc.gov/Recalls/2026/old-incomplete",
             "source_kind": "derived", "source_type": "derived", "source_record_id": "old-incomplete",
             "verification_status": "verified", "published_at": "2026-08-20",
             **lineage_fields(["old-incomplete"], ["d" * 64]),
             "schema_version": "2.0", "display_locale": "zh-CN",
             "generator_version": generate_alerts.GENERATOR_VERSION},
        ]]
        self.assertEqual(generate_alerts.merge_alerts(existing, []), [])

    def test_old_generator_version_is_not_retained(self):
        meta = {
            "source": "CPSC", "source_url": "https://www.cpsc.gov/Recalls/2026/old-version",
            "source_kind": "derived", "source_type": "derived", "source_record_id": "old-version",
            "verification_status": "verified", "published_at": "2026-08-20",
            "collected_at": "2026-08-21T00:00:00Z", "verified_at": "2026-08-21T00:00:00Z",
            "verification_notes": "已核验", "evidence_hash": "c" * 64,
            **lineage_fields(["old-version"], ["c" * 64]),
            "schema_version": generate_alerts.ALERT_SCHEMA_VERSION, "display_locale": "zh-CN",
            "generator_version": "2026.09.01.2",
        }
        row = ["old-version", "policy", "high", "旧生成器预警", "美国", "CPSC", "旧版本", "2026-08-20", False, meta]
        self.assertIsNone(generate_alerts.normalize_existing_alert(row))

    def test_serialize_alert_requires_verified_upstream_provenance(self):
        incomplete = {
            "id": "generated-pending", "title": "待核验预警", "detail": "来源尚未核验",
            "source": "CPSC", "url": "https://www.cpsc.gov/Recalls/2026/generated-pending",
            "source_record_id": "cpsc-pending", "published_at": generate_alerts.TODAY,
            "collected_at": generate_alerts.TODAY,
        }
        self.assertIsNone(generate_alerts.serialize_alert(incomplete))

    def test_serialize_alert_preserves_derived_provenance(self):
        alert = {
            "id": "generated-verified", "type": "policy", "level": "high",
            "title": "已核验预警", "market": "美国", "platform": "CPSC",
            "detail": "来源可追溯", "date": generate_alerts.TODAY,
            "source": "CPSC", "url": "https://www.cpsc.gov/Recalls/2026/generated-verified",
            "source_record_id": "cpsc-verified", "published_at": generate_alerts.TODAY,
            "collected_at": "2026-09-06T00:00:00Z", "verified_at": "2026-09-06T00:00:00Z",
            "verification_status": "verified", "category_codes": ["electronics"],
            "upstream_evidence_hash": "b" * 64,
            **lineage_fields(["cpsc-verified"], ["b" * 64]),
        }
        row = generate_alerts.serialize_alert(alert)
        self.assertIsNotNone(row)
        self.assertEqual(row[9]["source_kind"], "derived")
        self.assertEqual(row[9]["source_type"], "derived")
        self.assertEqual(row[9]["generator_version"], generate_alerts.GENERATOR_VERSION)
        self.assertRegex(row[9]["evidence_hash"], r"^[0-9a-f]{64}$")

    def test_cpsc_aggregate_carries_complete_snapshot_and_record_lineage(self):
        records = []
        for index in range(3):
            records.append({
                "id": f"cpsc-{index}", "title": f"Recall {index}",
                "title_zh": f"召回产品{index}", "description_zh": "产品存在安全风险",
                "date": "2026-09-06", "category": "electronics",
                "url": f"https://www.cpsc.gov/Recalls/2026/cpsc-{index}",
                "source": "CPSC", "source_url": f"https://www.cpsc.gov/Recalls/2026/cpsc-{index}",
                "source_record_id": f"cpsc-{index}", "source_kind": "official", "source_type": "regulator",
                "verification_status": "verified", "published_at": "2026-09-06",
                "collected_at": "2026-09-06T00:00:00Z", "verified_at": "2026-09-06T00:00:00Z",
                "verification_notes": "已核验", "evidence_hash": str(index + 1) * 64,
            })
        payload = {"meta": {"generated_at": "2026-09-06T01:00:00Z"}, "china_related": records}
        with patch.object(generate_alerts, "load_json", return_value=payload):
            alerts = generate_alerts.generate_from_cpsc()
        aggregate = next(alert for alert in alerts if alert.get("lineage_type") == "aggregate")
        self.assertEqual(aggregate["matched_record_count"], 3)
        self.assertEqual(aggregate["aggregate_count"], 3)
        self.assertEqual(aggregate["source_record_ids"], ["cpsc-0", "cpsc-1", "cpsc-2"])
        self.assertEqual(len(aggregate["upstream_evidence_hashes"]), 3)
        self.assertEqual(aggregate["dataset_snapshot_at"], "2026-09-06T01:00:00Z")
        self.assertRegex(aggregate["dataset_snapshot_id"], r"^[0-9a-f]{64}$")
        row = generate_alerts.serialize_alert(aggregate)
        self.assertIsNotNone(row)
        self.assertEqual(row[9]["source_record_evidence"][1]["source_record_id"], "cpsc-1")

    def test_aggregate_rejects_missing_hash_or_count_mismatch(self):
        base = {
            "id": "aggregate", "type": "policy", "level": "high",
            "title": "近90天3起召回", "market": "美国", "platform": "CPSC",
            "detail": "统计窗口内共有3起召回。", "date": "2026-09-06",
            "source": "CPSC 数据分析", "url": "https://www.saferproducts.gov/RestWebServices/Recall",
            "source_record_id": "aggregate-source", "published_at": "2026-09-06",
            "collected_at": "2026-09-06T00:00:00Z", "verified_at": "2026-09-06T00:00:00Z",
            "verification_status": "verified",
            **lineage_fields(["a", "b", "c"], ["1" * 64, "2" * 64, "3" * 64], "aggregate"),
        }
        self.assertIsNotNone(generate_alerts.serialize_alert(base))
        missing_hash = dict(base, upstream_evidence_hashes=["1" * 64, "2" * 64])
        self.assertIsNone(generate_alerts.serialize_alert(missing_hash))
        wrong_count = dict(base, matched_record_count=2)
        self.assertIsNone(generate_alerts.serialize_alert(wrong_count))

    def test_alert_evidence_hash_changes_with_dataset_snapshot(self):
        alert = {
            "id": "generated-verified", "title": "已核验预警", "detail": "来源可追溯",
            "source": "CPSC", "url": "https://www.cpsc.gov/Recalls/2026/generated-verified",
            "source_record_id": "cpsc-verified", "published_at": "2026-09-06",
            "collected_at": "2026-09-06T00:00:00Z", "verified_at": "2026-09-06T00:00:00Z",
            "verification_status": "verified", "upstream_evidence_hash": "b" * 64,
            **lineage_fields(["cpsc-verified"], ["b" * 64]),
        }
        first = generate_alerts.serialize_alert(alert)
        second = generate_alerts.serialize_alert(dict(alert, dataset_snapshot_id="d" * 64))
        self.assertNotEqual(first[9]["evidence_hash"], second[9]["evidence_hash"])

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
        self.assertEqual(alerts[0]["source_record_id"], "policy-change-1")
        self.assertEqual(alerts[0]["verification_status"], None)

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
