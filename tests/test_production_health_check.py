import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import production_health_check
from scripts.production_health_check import HealthCheckError


class ProductionHealthCheckTests(unittest.TestCase):
    def test_failed_frontend_does_not_stop_remaining_component_probes(self):
        called = []

        def failed_frontend():
            called.append("frontend")
            raise HealthCheckError("FRONTEND_UNAVAILABLE", "frontend failed")

        def passing(name):
            def probe():
                called.append(name)
                return {"http_status": 200}
            return probe

        probes = {
            "frontend": failed_frontend,
            "release_manifest": passing("release_manifest"),
            "database": passing("database"),
            "storage": passing("storage"),
            "edge_functions": passing("edge_functions"),
            "auth": passing("auth"),
        }
        result = production_health_check.collect_health(probes)

        self.assertEqual(called, list(probes))
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["kind"], "production_availability")
        self.assertEqual(set(result["components"]), set(probes))
        self.assertEqual(result["components"]["frontend"]["error_code"], "FRONTEND_UNAVAILABLE")
        self.assertEqual(result["failed_components"], ["frontend"])
        self.assertEqual(result["summary"], {"passed": 5, "degraded": 0, "failed": 1})
        self.assertTrue(all(result["components"][name]["status"] == "passed" for name in list(probes)[1:]))

    def test_database_failure_does_not_stop_frontend_or_functions(self):
        called = []

        def probe(name, *, fail=False):
            def run():
                called.append(name)
                if fail:
                    raise HealthCheckError("DATABASE_UNAVAILABLE", "database failed", http_status=503)
                return {}
            return run

        probes = {
            "database": probe("database", fail=True),
            "edge_functions": probe("edge_functions"),
            "frontend": probe("frontend"),
        }
        result = production_health_check.collect_health(probes)

        self.assertEqual(called, ["database", "edge_functions", "frontend"])
        self.assertEqual(result["components"]["database"]["status"], "failed")
        self.assertEqual(result["components"]["edge_functions"]["status"], "passed")
        self.assertEqual(result["components"]["frontend"]["status"], "passed")

    def test_main_writes_all_results_and_returns_nonzero_for_failure(self):
        payload = {
            "kind": "production_availability",
            "status": "failed",
            "checked_at": "2026-09-09T00:00:00+00:00",
            "release_sha": "sha",
            "duration_ms": 10,
            "summary": {"passed": 5, "degraded": 0, "failed": 1},
            "failed_components": ["frontend"],
            "components": {
                "frontend": {"status": "failed"},
                "release_manifest": {"status": "passed"},
                "database": {"status": "passed"},
                "storage": {"status": "passed"},
                "edge_functions": {"status": "passed"},
                "auth": {"status": "passed"},
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "health.json"
            with patch.object(production_health_check, "collect_health", return_value=payload):
                exit_code = production_health_check.main(["--output", str(output)])
            self.assertEqual(exit_code, 1)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), payload)

    def test_each_edge_function_is_recorded_when_one_request_raises(self):
        responses = []

        def fake_request(_method, url, **_kwargs):
            name = url.rsplit("/", 1)[-1]
            responses.append(name)
            if name == "report-export":
                raise OSError("temporary network failure")
            return 405, b"", {"X-JAY-Release": "sha"}

        with patch.dict(production_health_check.os.environ, {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_ANON_KEY": "anon",
            "EXPECTED_RELEASE_SHA": "sha",
        }, clear=True), patch.object(production_health_check, "request", side_effect=fake_request):
            with self.assertRaises(HealthCheckError) as raised:
                production_health_check.probe_edge_functions()

        self.assertEqual(responses, list(production_health_check.EDGE_FUNCTIONS))
        functions = raised.exception.details["functions"]
        self.assertEqual(set(functions), set(production_health_check.EDGE_FUNCTIONS))
        self.assertEqual(functions["report-export"]["status"], "failed")
        self.assertTrue(all(
            details["status"] == "passed"
            for name, details in functions.items()
            if name != "report-export"
        ))

    def test_each_database_table_is_recorded_when_one_request_raises(self):
        responses = []

        def fake_request(_method, url, **_kwargs):
            table = url.split("/rest/v1/", 1)[1].split("?", 1)[0]
            responses.append(table)
            if table == "market_catalog":
                raise OSError("temporary database connection failure")
            return 200, b"[]", {}

        with patch.dict(production_health_check.os.environ, {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_ANON_KEY": "anon",
        }, clear=True), patch.object(production_health_check, "request", side_effect=fake_request):
            with self.assertRaises(HealthCheckError) as raised:
                production_health_check.probe_database()

        self.assertEqual(responses, ["market_catalog", "market_data_applicability"])
        tables = raised.exception.details["tables"]
        self.assertEqual(tables["market_catalog"]["status"], "failed")
        self.assertEqual(tables["market_data_applicability"]["status"], "passed")


if __name__ == "__main__":
    unittest.main()
