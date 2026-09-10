import unittest
from unittest.mock import patch

from scripts import production_acceptance


class ProductionAcceptanceTests(unittest.TestCase):
    def test_fault_signature_matches_the_edge_function_vector(self):
        with patch.object(production_acceptance, "SERVICE_KEY", "service-role-test-key"):
            headers = production_acceptance.acceptance_fault_headers(
                "00000000-0000-4000-8000-000000000001",
                "provider_timeout",
                "acceptance-provider-timeout-1",
                issued_at=1_780_000_000,
            )
        self.assertEqual(headers["X-JAY-Acceptance-Scenario"], "provider_timeout")
        self.assertEqual(
            headers["X-JAY-Acceptance"],
            "1780000000.0645baa68854f6dfaaf2b9da7f874ae1488b09197cfbf29c7e3549eb07bfcf84",
        )


if __name__ == "__main__":
    unittest.main()
