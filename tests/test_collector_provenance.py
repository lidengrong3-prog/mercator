import os
import sys
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import collect_cpsc  # noqa: E402
import collect_us_macro  # noqa: E402


class CollectorProvenanceTests(unittest.TestCase):
    def test_macro_records_are_annotated_at_collection_time(self):
        with patch.object(collect_us_macro, "fetch_fred", return_value={"value": "1", "date": "2026-08-29"}), \
                patch.object(collect_us_macro, "fetch_bls", return_value={"value": "2", "date": "2026-M07"}):
            data = collect_us_macro.collect_all(fred_key="test-key")
        self.assertGreater(len(data["indicators"]), 0)
        for record in data["indicators"].values():
            self.assertEqual(record["source_kind"], "official")
            self.assertEqual(record["source_type"], "official_feed")
            self.assertEqual(record["verification_status"], "verified")
            self.assertTrue(record["source_record_id"])
            self.assertTrue(record["evidence_hash"])

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
