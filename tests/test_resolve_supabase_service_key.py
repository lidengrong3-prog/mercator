import unittest

from scripts.resolve_supabase_service_key import find_service_key


class ResolveSupabaseServiceKeyTests(unittest.TestCase):
    def test_extracts_legacy_service_role_key_without_printing_other_keys(self):
        self.assertEqual(find_service_key([
            {"name": "anon", "api_key": "anon-value"},
            {"name": "service_role", "api_key": "service-value"},
        ]), "service-value")

    def test_accepts_wrapped_management_api_response(self):
        self.assertEqual(find_service_key({"api_keys": [
            {"type": "secret", "key": "secret-value"},
        ]}), "secret-value")

    def test_fails_closed_when_service_key_is_missing(self):
        with self.assertRaisesRegex(ValueError, "service-role"):
            find_service_key([{"name": "anon", "api_key": "anon-value"}])


if __name__ == "__main__":
    unittest.main()
