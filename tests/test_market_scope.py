import unittest
import tempfile
import json

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from market_scope import configured_catalog, normalize_category_code, resolve_market_scopes  # noqa: E402
import collect_tikhub_pilot as pilot  # noqa: E402


class MarketScopeTests(unittest.TestCase):
    def test_catalog_exposes_manifest_categories_and_string_version(self):
        manifest = {
            "config_version": "test-2",
            "markets": [{
                "code": "US", "status": "active", "data_status": "configured",
                "category_keys": ["generic", "pet-food", "pet-supplies"],
            }],
            "platforms": [{"key": "amazon", "name": "Amazon"}],
            "market_platforms": [{
                "market_code": "US", "platform_key": "amazon",
                "status": "active", "data_status": "configured",
            }],
            "categories": [
                {"code": "generic", "aliases": ["general"], "status": "active"},
                {"code": "pet-food", "aliases": ["pet food"], "status": "active"},
                {"code": "pet-supplies", "aliases": ["pet supplies"], "status": "active"},
            ],
        }
        catalog = configured_catalog(manifest, market_codes=["US"])
        self.assertEqual(catalog["config_version"], "test-2")
        self.assertEqual(catalog["category_keys"], ["generic", "pet-food", "pet-supplies"])
        self.assertEqual(normalize_category_code("pet food", manifest, market_codes=["US"]), "pet-food")
        self.assertEqual(normalize_category_code("toys", manifest, market_codes=["US"]), "generic")

    def test_configured_and_schema_only_launch_markets_are_distinct(self):
        manifest = {
            "markets": [
                {"code": "US", "name": "美国", "status": "active", "data_status": "configured", "platform_keys": ["tiktok-shop"]},
                {"code": "ID", "name": "印度尼西亚", "status": "active", "data_status": "schema_only", "platform_keys": ["tiktok-shop"]},
            ],
            "market_platforms": [
                {"market_code": "US", "platform_key": "tiktok-shop", "status": "active", "data_status": "configured"},
                {"market_code": "ID", "platform_key": "tiktok-shop", "status": "active", "data_status": "schema_only"},
            ],
        }
        scopes = resolve_market_scopes(manifest)
        self.assertEqual({row["market_code"]: row["executable"] for row in scopes},
                         {"ID": False, "US": True})

    def test_schema_only_scope_never_makes_provider_requests(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8") as handle:
            json.dump({}, handle)
            handle.flush()
            result = pilot.collect_pilot(run_date="2026-09-14", market_code="ID", fixture_path=handle.name, dry_run=True)
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["data_status"], "schema_only")
        self.assertEqual(result["request_count"], 0)


if __name__ == "__main__":
    unittest.main()
