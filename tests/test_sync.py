import json
import os
import sys
import unittest


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import sync_to_supabase  # noqa: E402


class SyncTests(unittest.TestCase):
    def test_public_bundle_is_built_for_frontend_market_data_table(self):
        report = {
            "generated_at": "2026-08-27T00:00:00+00:00",
            "status": "healthy",
            "datasets": {},
        }
        rows = sync_to_supabase.build_market_data_rows(report)
        self.assertEqual(
            {row["key"] for row in rows},
            {"countries", "platforms", "policies", "rules", "alerts", "quality_report"},
        )
        self.assertTrue(all(set(row) == {"key", "data", "meta"} for row in rows))

    def test_legacy_table_fanout_is_opt_in(self):
        old = os.environ.pop("SUPABASE_SYNC_LEGACY_TABLES", None)
        try:
            self.assertFalse(sync_to_supabase.legacy_tables_enabled())
            os.environ["SUPABASE_SYNC_LEGACY_TABLES"] = "1"
            self.assertTrue(sync_to_supabase.legacy_tables_enabled())
        finally:
            if old is None:
                os.environ.pop("SUPABASE_SYNC_LEGACY_TABLES", None)
            else:
                os.environ["SUPABASE_SYNC_LEGACY_TABLES"] = old


if __name__ == "__main__":
    unittest.main()
