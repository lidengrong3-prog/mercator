import unittest
from datetime import datetime
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

    def test_acceptance_report_bounds_evidence_per_required_domain(self):
        evidence = []
        for domain, row_domain in (("policy", "policy"), ("platform", "rule")):
            for index in range(10):
                evidence.append({
                    "domain": row_domain,
                    "record_key": f"{domain}-{index}",
                    "market_code": "US",
                    "platform_key": "amazon" if domain == "platform" else None,
                    "category_code": None,
                    "source_record_id": f"{domain}-source-{index}",
                    "source_url": f"https://example.test/{domain}/{index}",
                    "verification_status": "verified",
                    "evidence_hash": f"hash-{domain}-{index}",
                    "published_at": f"2026-09-{index + 1:02d}T00:00:00Z",
                    "verified_at": f"2026-09-{index + 1:02d}T00:00:00Z",
                    "status": "active",
                    "payload": {"source_name": f"{domain} source {index}"},
                })

        def select_rows(table, _token, _query):
            if table == "report_template_catalog":
                return [{"id": "template", "code": "market-research", "version": 1,
                         "required_domains": ["policy", "platform"], "status": "active"}]
            if table == "market_data_applicability":
                return evidence
            if table == "market_data":
                return [{"data": {"schema_version": 1, "data_contract_version": "3.0",
                                   "generated_at": datetime.now().astimezone().isoformat(),
                                   "status": "healthy", "publishable": True, "datasets": {}}}]
            raise AssertionError(f"unexpected table: {table}")

        with patch.object(production_acceptance, "select_rows", side_effect=select_rows):
            content = production_acceptance.build_server_validated_report_content("token", "验收摘要")

        self.assertEqual(len(content["source_appendix"]), 6)
        self.assertTrue(all(cell["recordCount"] == 3 for cell in content["coverage_matrix"]["cells"]))
        self.assertLess(len(content["text"]), 80_000)


if __name__ == "__main__":
    unittest.main()
