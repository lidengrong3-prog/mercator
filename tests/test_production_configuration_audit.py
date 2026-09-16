import unittest

from scripts.audit_production_configuration import (
    AuditError,
    fingerprint,
    production_origin,
    safe_runtime_error,
)


class ProductionConfigurationAuditTests(unittest.TestCase):
    def test_production_origin_strips_the_site_path(self):
        self.assertEqual(
            production_origin("https://example.github.io/project/"),
            "https://example.github.io",
        )

    def test_production_origin_rejects_non_https_and_query_values(self):
        for value in ("http://example.com/project/", "https://example.com/?token=secret"):
            with self.subTest(value=value):
                with self.assertRaises(AuditError):
                    production_origin(value)

    def test_fingerprints_are_stable_and_do_not_expose_input(self):
        value = "acceptance@example.com"
        digest = fingerprint(value)
        self.assertEqual(len(digest), 12)
        self.assertEqual(digest, fingerprint(value))
        self.assertNotIn("acceptance", digest)

    def test_runtime_error_only_accepts_bounded_machine_codes(self):
        self.assertEqual(
            safe_runtime_error({"error": "BILLING_ENTITLEMENTS_UNAVAILABLE"}),
            "BILLING_ENTITLEMENTS_UNAVAILABLE",
        )
        self.assertEqual(safe_runtime_error({"error": "secret=value"}), "UNKNOWN_ERROR")
        self.assertEqual(safe_runtime_error({}), "UNKNOWN_ERROR")


if __name__ == "__main__":
    unittest.main()
