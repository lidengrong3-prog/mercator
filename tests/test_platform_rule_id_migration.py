import os
import sys
import unittest
from datetime import datetime, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import migrate_platform_rule_ids  # noqa: E402


class PlatformRuleIdentityMigrationTests(unittest.TestCase):
    def test_migration_rekeys_current_and_historical_versions(self):
        payload = {
            "items": [{
                "id": "legacy-rule",
                "platform": "eBay",
                "platform_key": "ebay",
                "market": "US",
                "title": "Seller fees",
                "summary": "Fees and payouts apply.",
                "rule_key": "a" * 24,
                "source_record_id": "a" * 24,
                "source_url": "https://www.ebay.com/help/selling/fees?id=4079",
                "verification_status": "verified",
                "verified_at": "2026-09-17T00:00:00+00:00",
                "published_at": "2026-09-17",
                "collected_at": "2026-09-17T00:00:00+00:00",
                "version_history": [{
                    "rule_key": "a" * 24,
                    "source_url": "https://www.ebay.com/help/selling/fees?id=4079",
                    "rule_version": "1",
                }],
            }],
            "platform_coverage": {key: {} for key in (
                "amazon", "tiktok-shop", "aliexpress", "ebay"
            )},
        }
        migrated = migrate_platform_rule_ids.migrate_payload(
            payload, now=datetime(2026, 9, 18, tzinfo=timezone.utc)
        )
        row = migrated["items"][0]
        self.assertEqual(row["source_record_id"], "ebay:4079")
        self.assertEqual(row["rule_key"], "ebay:4079")
        self.assertEqual(row["version_history"][0]["source_record_id"], "ebay:4079")
        self.assertEqual(row["version_history"][0]["rule_key"], "ebay:4079")
        self.assertEqual(migrated["platform_coverage"]["ebay"]["status"], "partial")
        self.assertEqual(migrated["source_identity_migration"]["records_updated"], 1)


if __name__ == "__main__":
    unittest.main()
