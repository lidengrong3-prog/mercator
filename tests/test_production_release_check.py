import unittest
from unittest.mock import patch

from scripts import production_release_check
from scripts.production_release_check import ReleaseCheckError, validate_webhook_probe


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

    def test_database_probes_use_each_tables_real_primary_key(self):
        requests = []

        def fake_request(method, url, *, headers=None, body=None):
            requests.append((method, url))
            if url.endswith("/release.json"):
                return 200, b'{"release_sha":"sha","migration_head":"migration","production_origin":"https://example.com"}', {}
            if url == "https://example.com/":
                return 200, b"JAY", {}
            if url.endswith("/assets/js/catalog.js"):
                return 200, b"var JAY_SUPABASE_URL = 'https://project.supabase.co';", {}
            if "/auth/v1/token" in url:
                return 200, b'{"access_token":"token"}', {}
            if "/rest/v1/" in url:
                return 200, b"[]", {}
            if method == "GET" and "/functions/v1/" in url:
                return 405, b'{"error":"METHOD_NOT_ALLOWED"}', {"X-JAY-Release": "sha"}
            if url.endswith("/functions/v1/ai-proxy") and headers and "Origin" in headers:
                return 403, b'{"error":"FORBIDDEN_ORIGIN"}', {}
            if url.endswith("/functions/v1/ai-proxy"):
                return 401, b'{"error":"UNAUTHORIZED"}', {}
            if url.endswith("/functions/v1/billing-status"):
                return 200, b'{"billing_enabled":false,"entitlement":{"plan":"free"}}', {}
            if url.endswith("/functions/v1/billing-webhook"):
                return 503, b'{"error":"BILLING_WEBHOOK_NOT_CONFIGURED"}', {}
            raise AssertionError(f"unexpected request: {method} {url}")

        acceptance = b'{"status":"passed","release_sha":"sha","checks":{"database":true,"storage_bucket":true,"storage_policy":true,"edge_functions":true}}'
        with patch.dict("os.environ", {
            "PRODUCTION_SITE_URL": "https://example.com/",
            "SUPABASE_URL": "https://project.supabase.co",
            "SUPABASE_ANON_KEY": "anon",
            "EXPECTED_RELEASE_SHA": "sha",
            "EXPECTED_MIGRATION_HEAD": "migration",
            "ACCEPTANCE_RESULT_FILE": "acceptance.json",
            "PROD_TEST_USER_A_EMAIL": "a@example.com",
            "PROD_TEST_USER_A_PASSWORD": "password",
        }, clear=True), patch.object(production_release_check.Path, "read_bytes", return_value=acceptance), patch.object(
            production_release_check, "request", side_effect=fake_request
        ):
            self.assertEqual(production_release_check.main(), 0)

        urls = [url for _, url in requests]
        self.assertIn("https://project.supabase.co/rest/v1/market_catalog?select=code&limit=1", urls)
        self.assertIn("https://project.supabase.co/rest/v1/market_data_applicability?select=id&limit=1", urls)


if __name__ == "__main__":
    unittest.main()
