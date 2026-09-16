import unittest

from scripts.audit_production_configuration import AuditError, fingerprint, production_origin


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


if __name__ == "__main__":
    unittest.main()
