import unittest

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


if __name__ == "__main__":
    unittest.main()
