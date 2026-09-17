import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, os.fspath(ROOT / "scripts"))

import validate_data  # noqa: E402


class PublicProjectionValidationTests(unittest.TestCase):
    def write_json(self, root, relative_path, value):
        path = Path(root) / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def valid_record(self, record_id="policy-1", **changes):
        record = {
            "id": record_id,
            "title": "Public record",
            "market": "US",
            "market_codes": ["US"],
            "source": "Official source",
            "source_url": f"https://example.gov/records/{record_id}",
            "source_kind": "official",
            "source_type": "government",
            "source_record_id": record_id,
            "verification_status": "verified",
            "published_at": "2026-09-10",
            "collected_at": "2026-09-10T08:00:00+00:00",
            "verified_at": "2026-09-10T08:00:00+00:00",
            "evidence_hash": "a" * 64,
        }
        record.update(changes)
        return record

    def create_projection(self, root):
        manifest = {
            "config_version": "test",
            "default_market_codes": ["US"],
            "markets": [{"code": "US", "key": "us", "name": "美国", "aliases": ["United States"], "category_keys": ["generic"]}],
            "platforms": [{"key": "amazon", "name": "Amazon"}],
            "categories": [{"code": "generic", "name": "通用品类", "status": "active"}],
            "market_platforms": [{
                "market_code": "US",
                "platform_key": "amazon",
                "status": "active",
                "data_status": "configured",
            }],
        }
        counts = {
            "countries": 1,
            "platforms": 1,
            "policies": 1,
            "rules": 1,
            "alerts": 0,
            "taxes": 0,
            "access_requirements": 0,
            "macro": 1,
        }
        quality = {
            "schema_version": 1,
            "data_contract_version": "3.0",
            "generated_at": "2026-09-10T09:00:00+00:00",
            "status": "healthy",
            "publishable": True,
            "scope": {"market_codes": ["US"], "platform_names": ["Amazon"], "category_codes": ["generic"]},
            "summary": {"errors": 0},
            "datasets": {
                key: {"formal_records": count, "errors": []}
                for key, count in counts.items()
            },
        }
        rule = self.valid_record(
            "rule-1", platform="Amazon", platform_key="amazon",
            source_type="platform", rule_key="rule-1", rule_version="1",
        )
        macro = self.valid_record(
            "macro-1", name="Retail sales", date="2026-09-01",
            source_type="official_feed",
        )
        macro.pop("id")
        macro.pop("published_at")
        advisory = {
            "id": "advisory-1",
            "title": "Industry reference",
            "summary": "Editorial summary",
            "source": "Industry source",
            "source_url": "https://www.cifnews.com/article/1",
            "source_kind": "traceable",
            "source_type": "licensed_provider",
            "source_class": "industry_advisory",
            "verification_status": "pending",
            "published_at": "2026-09-09",
            "collected_at": "2026-09-10T08:00:00+00:00",
            "market_codes": ["US"],
        }

        self.write_json(root, "market_scope.json", manifest)
        self.write_json(root, "quality_report.json", quality)
        self.write_json(root, "countries.json", {"us": {"code": "US", "name": "美国"}})
        self.write_json(root, "platforms.json", [{"name": "Amazon"}])
        self.write_json(root, "policies.json", {"items": [self.valid_record()]})
        self.write_json(root, "rules.json", {"items": [rule]})
        self.write_json(root, "alerts.json", [])
        self.write_json(root, "taxes.json", {"items": []})
        self.write_json(root, "access_requirements.json", {"items": []})
        self.write_json(root, "industry_advisories.json", {"items": [advisory]})
        self.write_json(root, "us_market/macro_indicators.json", {"indicators": {"TEST": macro}})
        return quality

    def test_public_projection_passes_without_private_collector_files(self):
        with tempfile.TemporaryDirectory() as directory:
            self.create_projection(directory)
            self.assertFalse((Path(directory) / "collection_run.json").exists())
            self.assertFalse((Path(directory) / "us_market" / "cpsc_recalls.json").exists())
            self.assertFalse((Path(directory) / "us_market" / "index.json").exists())

            report = validate_data.validate_public_projection(data_dir=directory)

        self.assertTrue(report["publishable"])
        self.assertEqual(report["status"], "healthy")
        self.assertEqual(report["datasets"]["industry_advisories"]["formal_records"], 0)

    def test_public_projection_requires_a_publishable_source_quality_report(self):
        with tempfile.TemporaryDirectory() as directory:
            quality = self.create_projection(directory)
            quality["publishable"] = False
            quality["status"] = "failed"
            quality["summary"]["errors"] = 1
            self.write_json(directory, "quality_report.json", quality)

            report = validate_data.validate_public_projection(data_dir=directory)

        self.assertFalse(report["publishable"])
        self.assertIn("publishable 必须为 true", "\n".join(report["datasets"]["quality_report"]["errors"]))

    def test_degraded_source_quality_report_remains_publishable(self):
        with tempfile.TemporaryDirectory() as directory:
            quality = self.create_projection(directory)
            quality["status"] = "degraded"
            self.write_json(directory, "quality_report.json", quality)

            report = validate_data.validate_public_projection(data_dir=directory)

        self.assertTrue(report["publishable"])
        self.assertEqual(report["status"], "degraded")

    def test_public_record_count_must_match_quality_report_formal_count(self):
        with tempfile.TemporaryDirectory() as directory:
            quality = self.create_projection(directory)
            quality["datasets"]["policies"]["formal_records"] = 2
            self.write_json(directory, "quality_report.json", quality)

            report = validate_data.validate_public_projection(data_dir=directory)

        self.assertFalse(report["publishable"])
        self.assertIn("公开记录数与质量报告不一致", "\n".join(report["datasets"]["policies"]["errors"]))

    def test_public_projection_rejects_non_formal_fact_records(self):
        variants = {
            "pending": {"verification_status": "pending"},
            "demo": {"source_kind": "demo"},
            "missing provenance": {"evidence_hash": None},
        }
        for label, changes in variants.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                self.create_projection(directory)
                self.write_json(
                    directory,
                    "policies.json",
                    {"items": [self.valid_record(**changes)]},
                )

                report = validate_data.validate_public_projection(data_dir=directory)

                self.assertFalse(report["publishable"])
                self.assertIn("非正式", "\n".join(report["datasets"]["policies"]["errors"]))

    def test_public_projection_rejects_duplicate_out_of_scope_and_non_https_records(self):
        with tempfile.TemporaryDirectory() as directory:
            quality = self.create_projection(directory)
            quality["datasets"]["policies"]["formal_records"] = 2
            self.write_json(directory, "quality_report.json", quality)
            self.write_json(directory, "policies.json", {"items": [
                self.valid_record("duplicate"),
                self.valid_record(
                    "duplicate",
                    market="EU",
                    market_codes=["EU"],
                    source_url="http://example.gov/records/duplicate",
                ),
            ]})

            report = validate_data.validate_public_projection(data_dir=directory)

        errors = "\n".join(report["datasets"]["policies"]["errors"])
        self.assertFalse(report["publishable"])
        self.assertIn("重复 ID", errors)
        self.assertIn("非 HTTPS", errors)
        self.assertIn("范围外", errors)

    def test_industry_advisories_must_remain_traceable_and_pending(self):
        with tempfile.TemporaryDirectory() as directory:
            self.create_projection(directory)
            path = Path(directory) / "industry_advisories.json"
            payload = json.loads(path.read_text(encoding="utf-8"))
            payload["items"][0]["source_kind"] = "official"
            payload["items"][0]["verification_status"] = "verified"
            self.write_json(directory, "industry_advisories.json", payload)

            report = validate_data.validate_public_projection(data_dir=directory)

        self.assertFalse(report["publishable"])
        self.assertIn("错误标记为正式或官方", "\n".join(report["datasets"]["industry_advisories"]["errors"]))

    def test_full_validation_still_requires_private_collection_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            result = validate_data.validate_collection_run(
                datetime(2026, 9, 10, tzinfo=timezone.utc),
                path=os.path.join(directory, "collection_run.json"),
                manifest={
                    "markets": [{"code": "US", "status": "active", "data_status": "configured"}],
                    "market_platforms": [],
                },
            )

        self.assertEqual(result.status, "failed")
        self.assertTrue(any("缺少本轮结构化采集运行记录" in error for error in result.errors))

    def test_public_cli_is_read_only_without_report_argument(self):
        passing = {"status": "healthy", "publishable": True, "datasets": {}}
        with patch.object(validate_data, "validate_public_projection", return_value=passing), \
                patch.object(validate_data, "write_report") as write_report, \
                patch.object(sys, "argv", ["validate_data.py", "--public-projection"]):
            exit_code = validate_data.main()

        self.assertEqual(exit_code, 0)
        write_report.assert_not_called()


if __name__ == "__main__":
    unittest.main()
