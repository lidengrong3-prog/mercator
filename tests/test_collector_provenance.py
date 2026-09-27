import os
import sys
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import collect_cpsc  # noqa: E402
import collect_us_macro  # noqa: E402


class CollectorProvenanceTests(unittest.TestCase):
    @staticmethod
    def bls_metadata():
        return {
            series_id: {
                "series_id": series_id,
                "series_title": configured["official_name"],
                "seasonal": configured["seasonal"],
                "base_period": configured["base_period"],
                "metadata_url": f"{collect_us_macro.BLS_METADATA_PAGE_BASE}/{series_id}",
                "survey": configured["survey"],
            }
            for series_id, configured in collect_us_macro.BLS_SERIES.items()
        }

    def test_macro_records_are_annotated_at_collection_time(self):
        with patch.object(collect_us_macro, "fetch_fred", return_value={"value": "1", "date": "2026-08-29"}), \
                patch.object(collect_us_macro, "fetch_bls", return_value={"value": "2", "date": "2026-07-01"}), \
                patch.object(collect_us_macro, "fetch_bls_series_metadata", return_value=self.bls_metadata()):
            data = collect_us_macro.collect_all(fred_key="test-key")
        self.assertGreater(len(data["indicators"]), 0)
        for record in data["indicators"].values():
            self.assertEqual(record["source_kind"], "official")
            self.assertEqual(record["source_type"], "official_feed")
            self.assertEqual(record["verification_status"], "verified")
            self.assertTrue(record["source_record_id"])
            self.assertTrue(record["evidence_hash"])

        for series_id, configured in collect_us_macro.BLS_SERIES.items():
            record = data["indicators"][f"BLS_{series_id}"]
            self.assertEqual(record["series_id"], series_id)
            self.assertEqual(record["source_record_id"], series_id)
            self.assertEqual(record["official_name"], configured["official_name"])
            self.assertEqual(record["unit"], configured["unit"])
            self.assertTrue(record["metadata_verified_at"])

    def test_bls_metadata_mismatch_prevents_bls_publication(self):
        metadata = self.bls_metadata()
        metadata["CES0000000001"] = dict(
            metadata["CES0000000001"],
            series_title="Average hourly earnings of all employees",
        )
        with patch.object(collect_us_macro, "fetch_fred", return_value={"value": "1", "date": "2026-08-29"}), \
                patch.object(collect_us_macro, "fetch_bls") as fetch_bls, \
                patch.object(collect_us_macro, "fetch_bls_series_metadata", return_value=metadata):
            data = collect_us_macro.collect_all(fred_key="test-key")
        fetch_bls.assert_not_called()
        self.assertFalse(data["meta"]["bls_metadata_verified"])
        self.assertFalse(any(key.startswith("BLS_") for key in data["indicators"]))

    def test_bls_config_matches_published_semantics(self):
        expected = {
            "CUSR0000SA0": ("美国城市平均 CPI-U：所有项目（季调）", "指数（1982-84=100）"),
            "CUSR0000SA0L1E": ("美国城市平均核心 CPI-U：剔除食品和能源（季调）", "指数（1982-84=100）"),
            "CUSR0000SA0L5": ("美国城市平均 CPI-U：剔除医疗保健（季调）", "指数（1982-84=100）"),
            "CES0000000001": ("美国非农就业人数：全部雇员（季调）", "千人"),
        }
        self.assertEqual(
            {series_id: (value["name"], value["unit"]) for series_id, value in collect_us_macro.BLS_SERIES.items()},
            expected,
        )

    def test_cpsc_records_are_annotated_without_inventing_fields(self):
        data = collect_cpsc.process_recalls([
            {
                "RecallNumber": "12345",
                "Title": "Test product recall",
                "Description": "Hazard details",
                "RecallDate": "2026-08-29",
                "URL": "https://www.cpsc.gov/Recalls/2026/test-product-recall",
                "ManufacturerCountries": [{"Country": "China"}],
                "Products": [{"Name": "Test product"}],
                "Hazards": [{"Name": "Fire"}],
            }
        ])
        record = data["recalls"][0]
        self.assertEqual(record["source_kind"], "official")
        self.assertEqual(record["source_type"], "regulator")
        self.assertEqual(record["verification_status"], "verified")
        self.assertEqual(record["source_url"], record["url"])
        self.assertTrue(record["verified_at"])
        self.assertTrue(record["evidence_hash"])


if __name__ == "__main__":
    unittest.main()
