import hashlib
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import collect_us_regulatory  # noqa: E402
import sync_to_supabase  # noqa: E402
from market_scope import configured_catalog, load_market_scope  # noqa: E402
from translate_regulatory_data import translation_is_current  # noqa: E402
from validate_data import ACCESS_REQUIREMENT_TYPES, TAX_TYPES, record_quality  # noqa: E402


class UsRegulatoryCollectorTests(unittest.TestCase):
    @staticmethod
    def fetcher(url, *, timeout):
        del timeout
        return {
            "requested_url": url,
            "final_url": url,
            "http_status": 200,
            "content_bytes": 1000,
            "source_content_hash": hashlib.sha256(url.encode("utf-8")).hexdigest(),
            "published_at": "2026-09-01",
            "source_last_modified_at": "2026-09-01T00:00:00+00:00",
        }

    def test_tax_and_access_catalogs_generate_formal_records(self):
        manifest = load_market_scope()
        expected_categories = set(configured_catalog(manifest, market_codes=["US"])["category_keys"])
        tax, tax_telemetry = collect_us_regulatory.collect_domain(
            "tax", manifest=manifest, fetcher=self.fetcher, now="2026-09-02T00:00:00+00:00"
        )
        access, access_telemetry = collect_us_regulatory.collect_domain(
            "access", manifest=manifest, fetcher=self.fetcher, now="2026-09-02T00:00:00+00:00"
        )
        self.assertGreater(len(tax["items"]), 0)
        self.assertGreater(len(access["items"]), 0)
        self.assertEqual(tax_telemetry["status"], "succeeded")
        self.assertEqual(access_telemetry["status"], "succeeded")
        self.assertEqual({item["tax_type"] for item in tax["items"]} - TAX_TYPES, set())
        self.assertEqual(
            {item["requirement_type"] for item in access["items"]} - ACCESS_REQUIREMENT_TYPES,
            set(),
        )
        self.assertEqual(set().union(*(set(item["category_codes"]) for item in tax["items"])), expected_categories)
        self.assertEqual(set().union(*(set(item["category_codes"]) for item in access["items"])), expected_categories)
        self.assertTrue(any(item.get("tax_subtype") == "additional_tariff" for item in tax["items"]))

    def test_every_generated_record_has_auditable_official_provenance(self):
        for domain in ("tax", "access"):
            data, _ = collect_us_regulatory.collect_domain(
                domain, fetcher=self.fetcher, now="2026-09-02T00:00:00+00:00"
            )
            for item in data["items"]:
                self.assertEqual(item["source_kind"], "official")
                self.assertEqual(item["verification_status"], "verified")
                self.assertRegex(item["evidence_hash"], r"^[0-9a-f]{64}$")
                self.assertRegex(item["source_content_hash"], r"^[0-9a-f]{64}$")
                self.assertTrue(item["source_url"].startswith("https://"))
                self.assertTrue(item["source_record_id"])
                self.assertTrue(item["published_at"])
                self.assertTrue(item["effective_from"])
                self.assertTrue(item["verified_at"])
                self.assertTrue(translation_is_current(item))
                self.assertTrue(record_quality(
                    item, domain=domain, require_scope=True, require_provenance=True
                )["formal"])

    def test_failed_refresh_retains_last_verified_records_without_advancing_check(self):
        existing, _ = collect_us_regulatory.collect_domain(
            "tax", fetcher=self.fetcher, now="2026-09-02T00:00:00+00:00"
        )

        def unavailable(url, *, timeout):
            del url, timeout
            raise RuntimeError("offline")

        refreshed, telemetry = collect_us_regulatory.collect_domain(
            "tax", existing=existing, fetcher=unavailable, now="2026-09-03T00:00:00+00:00"
        )
        self.assertEqual(
            [item["evidence_hash"] for item in refreshed["items"]],
            [item["evidence_hash"] for item in existing["items"]],
        )
        self.assertEqual(refreshed["last_checked_at"], existing["last_checked_at"])
        self.assertEqual(telemetry["status"], "degraded")
        self.assertTrue(telemetry["cache_used"])

    def test_governance_blocks_a_source_before_the_http_request(self):
        calls = []

        def fetcher(url, *, timeout):
            calls.append((url, timeout))
            return self.fetcher(url, timeout=timeout)

        original = collect_us_regulatory.assert_source_collectable

        def governed(source_key):
            if source_key == "fda":
                raise RuntimeError("source paused")
            return original(source_key)

        with patch.object(collect_us_regulatory, "assert_source_collectable", side_effect=governed):
            data, telemetry = collect_us_regulatory.collect_domain(
                "access", fetcher=fetcher, now="2026-09-02T00:00:00+00:00"
            )
        self.assertEqual(telemetry["status"], "degraded")
        self.assertTrue(telemetry["errors"])
        self.assertFalse(any("fda.gov" in url for url, _ in calls))
        self.assertTrue(all(item["source_key"] != "fda" for item in data["items"]))

    def test_checked_in_datasets_are_nonzero_and_formal(self):
        specs = (
            ("tax", ROOT / "data" / "taxes.json", "tax_type", TAX_TYPES),
            ("access", ROOT / "data" / "access_requirements.json", "requirement_type", ACCESS_REQUIREMENT_TYPES),
        )
        for domain, path, type_field, allowed_types in specs:
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertGreater(len(payload["items"]), 0)
            public_key = "taxes" if domain == "tax" else "access_requirements"
            public = sync_to_supabase.public_market_data_payload(public_key, payload)
            self.assertEqual(len(public["items"]), len(payload["items"]))
            for item in payload["items"]:
                self.assertIn(item[type_field], allowed_types)
                self.assertRegex(str(item.get("evidence_hash") or ""), r"^[0-9a-f]{64}$")
                self.assertTrue(record_quality(
                    item, domain=domain, require_scope=True, require_provenance=True
                )["formal"])

    def test_formal_projection_covers_every_configured_us_category(self):
        expected = set(configured_catalog(load_market_scope(), market_codes=["US"])["category_keys"])
        for dataset in ("taxes", "access_requirements"):
            rows = sync_to_supabase.build_applicability_rows(only=dataset)
            self.assertGreater(len(rows), 0)
            self.assertEqual({row["category_code"] for row in rows}, expected)
            self.assertTrue(all(row["source_record_id"] and row["evidence_hash"] for row in rows))


if __name__ == "__main__":
    unittest.main()
