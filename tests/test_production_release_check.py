import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import production_release_check
from scripts.production_release_check import (
    PRIVATE_PAGE_DATA_PATHS,
    PUBLIC_PAGE_DATA_PATHS,
    ReleaseCheckError,
    validate_browser_report_content_gate,
    validate_report_content_gate,
    validate_webhook_probe,
)


class ProductionReleaseCheckTests(unittest.TestCase):
    def test_enabled_billing_requires_the_signature_guard(self):
        result = validate_webhook_probe(400, b'{"error":"INVALID_STRIPE_SIGNATURE"}', True)
        self.assertEqual(result, "signature_verified")

    def test_disabled_billing_accepts_an_explicit_fail_closed_webhook(self):
        result = validate_webhook_probe(503, b'{"error":"BILLING_WEBHOOK_NOT_CONFIGURED"}', False)
        self.assertEqual(result, "disabled_fail_closed")

    def test_enabled_billing_rejects_an_unconfigured_webhook(self):
        with self.assertRaises(ReleaseCheckError):
            validate_webhook_probe(503, b'{"error":"BILLING_WEBHOOK_NOT_CONFIGURED"}', True)

    def test_report_content_gate_accepts_fail_closed_coverage_evidence(self):
        acceptance = {
            "report_content_gate": {
                "mode": "blocked",
                "formal_save": False,
                "formal_exports": False,
                "save_rejection": {
                    "status": 409,
                    "error": "REPORT_SERVER_VALIDATION_FAILED",
                    "reason_codes": ["QUALITY_PLATFORM_RULE_COVERAGE_MISSING"],
                },
            },
            "production_exceptions": {
                "blocked_exports": {
                    "pdf": {"status": 409, "error": "REPORT_NOT_SAVED"},
                    "docx": {"status": 409, "error": "REPORT_NOT_SAVED"},
                },
            },
        }
        self.assertEqual(validate_report_content_gate(acceptance), "blocked")

    def test_report_content_gate_rejects_a_block_without_a_coverage_reason(self):
        with self.assertRaises(ReleaseCheckError):
            validate_report_content_gate({
                "report_content_gate": {
                    "mode": "blocked",
                    "formal_save": False,
                    "formal_exports": False,
                    "save_rejection": {
                        "status": 409,
                        "error": "REPORT_SERVER_VALIDATION_FAILED",
                        "reason_codes": ["CONTENT_QUALITY_BLOCKED"],
                    },
                },
                "production_exceptions": {"blocked_exports": {}},
            })

    def test_browser_report_content_gate_accepts_a_local_only_draft(self):
        self.assertEqual(validate_browser_report_content_gate({
            "report_content_gate": {
                "mode": "blocked",
                "formal_save": False,
                "formal_exports": False,
                "browser_formal_requests": 0,
                "reason_codes": ["QUALITY_REQUIRED_DATA_MISSING"],
            },
            "exports": {},
        }), "blocked")

    def test_database_probes_use_each_tables_real_primary_key(self):
        requests = []

        def fake_request(method, url, *, headers=None, body=None):
            requests.append((method, url))
            if url.endswith("/release.json"):
                return 200, b'{"release_sha":"sha","migration_head":"migration","production_origin":"https://example.com"}', {}
            if url.endswith("/public-data-manifest.json"):
                return 200, json.dumps({
                    "policy": "explicit-allowlist-formal-projection",
                    "data_files": list(PUBLIC_PAGE_DATA_PATHS),
                }).encode(), {}
            if any(url.endswith("/" + path) for path in PUBLIC_PAGE_DATA_PATHS):
                return 200, b"{}", {}
            if any(url.endswith("/" + path) for path in PRIVATE_PAGE_DATA_PATHS):
                return 404, b"not found", {}
            if url == "https://example.com/":
                return 200, b"JAY", {}
            if url.endswith("/asset-manifest.json"):
                return 200, b'{"assets/runtime-config.js":"assets/runtime-config.abc123.js"}', {}
            if url.endswith("/assets/runtime-config.abc123.js"):
                return 200, b'window.JAY_APP_CONFIG = Object.freeze({"environment":"production","supabase":{"url":"https://project.supabase.co","anonKey":"anon"}});', {}
            if "/auth/v1/token" in url:
                return 200, b'{"access_token":"token"}', {}
            if "/rest/v1/" in url:
                return 200, b"[]", {}
            if method == "GET" and "/functions/v1/" in url:
                return 405, b'{"error":"METHOD_NOT_ALLOWED"}', {"X-JAY-Release": "sha"}
            if url.endswith("/functions/v1/history-search"):
                return 200, b'{"items":[],"counts":{"all":0},"total":0}', {}
            if url.endswith("/functions/v1/ai-proxy") and headers and "Origin" in headers:
                return 403, b'{"error":"FORBIDDEN_ORIGIN"}', {}
            if url.endswith("/functions/v1/ai-proxy"):
                return 401, b'{"error":"UNAUTHORIZED"}', {}
            if url.endswith("/functions/v1/billing-status"):
                return 200, b'{"billing_enabled":false,"entitlement":{"plan":"free"}}', {}
            if url.endswith("/functions/v1/notification-dispatch"):
                return 200, b'{"enabled":false,"channels":{"email":{"available":false},"wecom":{"available":false},"feishu":{"available":false}}}', {}
            if url.endswith("/functions/v1/billing-webhook"):
                return 503, b'{"error":"BILLING_WEBHOOK_NOT_CONFIGURED"}', {}
            raise AssertionError(f"unexpected request: {method} {url}")

        acceptance = {
            "status": "passed",
            "acceptance_run_id": "run-1",
            "release_sha": "sha",
            "report_content_gate": {
                "mode": "formal",
                "formal_save": True,
                "formal_exports": True,
            },
            "checks": {
                "database": True,
                "storage_bucket": True,
                "storage_policy": True,
                "edge_functions": True,
                "production_exceptions": True,
            },
            "production_exceptions": {
                "unauthorized": {"status": 401},
                "forbidden": {"status": 403, "error": "ORIGIN_NOT_ALLOWED"},
                "rate_limit": {"status": 429, "error": "AI_RATE_LIMITED", "logged": True},
                "provider_timeout": {"status": 504, "error": "AI_PROVIDER_TIMEOUT", "logged": True},
                "quota": {"status": 402, "error": "AI_QUOTA_EXCEEDED", "logged": True},
                "duplicate_generation": {"run_id": "run", "row_count": 1},
                "duplicate_exports": {
                    "pdf": {"id": "pdf", "row_count": 1, "duplicate_response": True},
                    "docx": {"id": "docx", "row_count": 1, "duplicate_response": True},
                },
            },
        }
        browser_acceptance = {
            "status": "passed",
            "acceptance_run_id": "run-1",
            "report_content_gate": {
                "mode": "formal",
                "formal_save": True,
                "formal_exports": True,
            },
            "exports": {"pdf": "pdf", "docx": "docx"},
            "network_recovery": {
                "first_request": "internetdisconnected",
                "attempts": 2,
                "recovered_with_production_response": True,
            },
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            acceptance_path = Path(temp_dir) / "acceptance.json"
            browser_acceptance_path = Path(temp_dir) / "browser-acceptance.json"
            acceptance_path.write_text(json.dumps(acceptance), encoding="utf-8")
            browser_acceptance_path.write_text(json.dumps(browser_acceptance), encoding="utf-8")
            with patch.dict("os.environ", {
                "PRODUCTION_SITE_URL": "https://example.com/",
                "SUPABASE_URL": "https://project.supabase.co",
                "SUPABASE_ANON_KEY": "anon",
                "EXPECTED_RELEASE_SHA": "sha",
                "EXPECTED_MIGRATION_HEAD": "migration",
                "ACCEPTANCE_RESULT_FILE": str(acceptance_path),
                "BROWSER_ACCEPTANCE_RESULT_FILE": str(browser_acceptance_path),
                "PROD_TEST_USER_A_EMAIL": "a@example.com",
                "PROD_TEST_USER_A_PASSWORD": "password",
                "NOTIFICATION_CHANNELS_ENABLED": "false",
            }, clear=True), patch.object(
                production_release_check, "request", side_effect=fake_request
            ):
                self.assertEqual(production_release_check.main(), 0)

        urls = [url for _, url in requests]
        self.assertIn("https://project.supabase.co/rest/v1/market_catalog?select=code&limit=1", urls)
        self.assertIn("https://project.supabase.co/rest/v1/market_data_applicability?select=id&limit=1", urls)
        for path in PRIVATE_PAGE_DATA_PATHS:
            self.assertIn("https://example.com/" + path, urls)


if __name__ == "__main__":
    unittest.main()
