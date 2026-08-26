import json
import os
import sys
import tempfile
import unittest


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import collect_cpsc  # noqa: E402
from quarantine_unverified_baseline import is_unverified  # noqa: E402


class CollectorTests(unittest.TestCase):
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
