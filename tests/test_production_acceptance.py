import unittest
from datetime import datetime
from io import BytesIO
from unittest.mock import patch
import zipfile

from scripts import production_acceptance


class ProductionAcceptanceTests(unittest.TestCase):
    def test_export_entitlement_uses_audited_workspace_subscription_rpc(self):
        workspace_id = "00000000-0000-4000-8000-000000000010"
        actor_id = "00000000-0000-4000-8000-000000000020"
        with patch.object(production_acceptance, "SERVICE_KEY", "service-role-test-key"), patch.object(
            production_acceptance,
            "request",
            return_value=(200, {"workspace_id": workspace_id, "plan": "pro", "status": "active"}, {}),
        ) as request:
            result = production_acceptance.ensure_export_entitlement(workspace_id, actor_id)

        self.assertEqual(result["plan"], "pro")
        _, url = request.call_args.args[:2]
        body = request.call_args.kwargs["body"]
        self.assertTrue(url.endswith("/rest/v1/rpc/configure_workspace_manual_subscription"))
        self.assertEqual(body["p_workspace_id"], workspace_id)
        self.assertEqual(body["p_actor_id"], actor_id)
        self.assertGreaterEqual(body["p_seat_limit"], 2)
        self.assertGreaterEqual(body["p_overrides"]["monthly_export_limit"], 4)

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
                         "required_domains": ["policy", "platform", "rule"], "status": "active"}]
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
        platform_cell = next(cell for cell in content["coverage_matrix"]["cells"] if cell["domain"] == "platform")
        self.assertFalse(platform_cell["covered"])
        self.assertEqual(platform_cell["ruleDimensions"], [])
        self.assertEqual(platform_cell["missingRuleDimensions"], list(production_acceptance.PLATFORM_RULE_DIMENSIONS))
        self.assertFalse(content["coverage_matrix"]["ok"])
        self.assertFalse(content["publishable"])
        self.assertLess(len(content["text"]), 80_000)

    def test_rule_dimension_keys_reads_normalized_payload(self):
        row = {
            "payload": {
                "rule_dimensions": {"fee": "official fee", "penalty": "official penalty", "deposit": ""},
                "topic": "settlement",
            }
        }
        self.assertEqual(production_acceptance.rule_dimension_keys(row), ["fee", "settlement", "penalty"])

    def test_bls_report_uses_dedicated_formal_macro_template(self):
        snapshot = {
            "name": production_acceptance.BLS_NONFARM_NAME,
            "value": "159075",
            "unit": production_acceptance.BLS_NONFARM_UNIT,
            "date": "2026-08-01",
            "source_url": "https://api.bls.gov/publicAPI/v2/timeseries/data/CES0000000001",
            "evidence_hash": "a" * 64,
        }
        evidence = {
            "domain": "market", "market_code": "US", "source_record_id": "CES0000000001",
            "source_url": snapshot["source_url"], "verification_status": "verified",
            "evidence_hash": snapshot["evidence_hash"], "retrieved_at": "2026-09-27T08:00:00Z",
            "payload": snapshot,
        }

        def select_rows(table, _token, _query):
            if table == "report_template_catalog":
                return [{"id": "macro-indicator-v1", "code": "macro-indicator", "version": 1,
                         "required_domains": ["market"], "status": "active"}]
            if table == "market_data":
                return [{"data": {"schema_version": 1, "data_contract_version": "3.0",
                                   "generated_at": datetime.now().astimezone().isoformat(),
                                   "status": "healthy", "publishable": True, "datasets": {}}}]
            raise AssertionError(f"unexpected table: {table}")

        with patch.object(production_acceptance, "select_rows", side_effect=select_rows):
            content = production_acceptance.build_server_validated_bls_report_content("token", snapshot, evidence)

        self.assertTrue(content["publishable"])
        self.assertEqual(content["template_id"], "macro-indicator")
        self.assertEqual(content["platform_keys"], [])
        self.assertEqual(content["coverage_matrix"]["cells"][0]["id"], "US|*|generic|market")
        self.assertEqual(content["coverage_matrix"]["cells"][0]["sourceRecordIds"], ["CES0000000001"])
        self.assertIn(production_acceptance.BLS_NONFARM_NAME, content["text"])
        self.assertIn("来源类别：官方统计数据", content["text"])
        self.assertNotIn("平均" + "时薪", content["text"])

    def test_bls_nonfarm_snapshot_rejects_legacy_hourly_earnings_label(self):
        record = {
            "series_id": production_acceptance.BLS_NONFARM_SERIES_ID,
            "name": "美国非农" + "平均" + "时薪",
            "official_name": production_acceptance.BLS_NONFARM_OFFICIAL_NAME,
            "value": "159075",
            "unit": production_acceptance.BLS_NONFARM_UNIT,
            "date": "2026-08-01",
            "source": "BLS",
            "source_url": "https://api.bls.gov/publicAPI/v2/timeseries/data/CES0000000001",
            "metadata_url": "https://data.bls.gov/timeseries/CES0000000001",
            "evidence_hash": "a" * 64,
        }
        with self.assertRaises(production_acceptance.AcceptanceError):
            production_acceptance.validate_bls_nonfarm_snapshot(record)

    def test_bls_ai_response_requires_formal_series_and_correct_semantics(self):
        snapshot = {
            "value": "159075", "unit": "千人", "date": "2026-08-01",
        }
        body = {
            "choices": [{"message": {"content": "CES0000000001 是美国非农就业人数（全部雇员），最新为 159,075 千人，数据日期 2026-08-01，来源 BLS。[H001]"}}],
            "jay_gateway": {"provider": "deepseek", "model": "test"},
            "jay_retrieval": {"citations": [{"source_record_id": "CES0000000001", "record_key": "BLS_CES0000000001"}]},
        }
        result = production_acceptance.verify_bls_ai_response(body, snapshot)
        self.assertEqual(result["series_id"], "CES0000000001")
        self.assertEqual(result["citation_count"], 1)

    def test_bls_report_section_and_docx_artifact_keep_canonical_semantics(self):
        snapshot = {
            "name": production_acceptance.BLS_NONFARM_NAME,
            "value": "159075",
            "unit": "千人",
            "date": "2026-08-01",
            "source_url": "https://api.bls.gov/publicAPI/v2/timeseries/data/CES0000000001",
            "evidence_hash": "a" * 64,
        }
        content = {
            "source_appendix": [],
            "source_record_ids": [],
            "model": {"sections": [], "sourceAppendix": []},
        }
        evidence = {
            "source_url": snapshot["source_url"],
            "verification_status": "verified",
            "evidence_hash": snapshot["evidence_hash"],
        }
        attached = production_acceptance.attach_bls_nonfarm_report_section(content, snapshot, evidence)
        self.assertEqual(attached["citation"], "S001")
        self.assertIn(production_acceptance.BLS_NONFARM_NAME, content["text"])
        self.assertNotIn("平均" + "时薪", content["text"])

        document_xml = (
            "<w:document>" + production_acceptance.BLS_NONFARM_NAME
            + " 159075 千人 2026-08-01 BLS</w:document>"
        ).encode("utf-8")
        relationships = f'<Relationships Target="{snapshot["source_url"]}"/>'.encode("utf-8")
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("word/document.xml", document_xml)
            archive.writestr("word/_rels/document.xml.rels", relationships)
        result = production_acceptance.verify_bls_export_artifact("docx", buffer.getvalue(), snapshot)
        self.assertEqual(result["status"], "passed")


if __name__ == "__main__":
    unittest.main()
