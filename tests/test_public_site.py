import json
import os
from pathlib import Path
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, os.fspath(ROOT / "scripts"))

import build_public_site  # noqa: E402
from production_release_check import PUBLIC_PAGE_DATA_PATHS  # noqa: E402
from sync_to_supabase import is_industry_advisory  # noqa: E402


class PublicSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.output = Path(cls.temp_dir.name) / "site"
        cls.manifest = build_public_site.build_public_site(cls.output, ROOT)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def read_public_json(self, relative_path):
        return json.loads((self.output / "data" / relative_path).read_text(encoding="utf-8"))

    def test_pages_artifact_contains_only_allowlisted_data_files(self):
        expected = {
            path.as_posix() for path in build_public_site.PUBLIC_DATASETS.values()
        }
        self.assertEqual(
            {"data/" + path for path in expected},
            set(PUBLIC_PAGE_DATA_PATHS),
        )
        actual = {
            path.relative_to(self.output / "data").as_posix()
            for path in (self.output / "data").rglob("*")
            if path.is_file()
        }
        self.assertEqual(actual, expected)
        self.assertTrue((self.output / "index.html").is_file())
        self.assertTrue((self.output / ".nojekyll").is_file())
        self.assertTrue((self.output / "assets").is_dir())
        asset_manifest = json.loads((self.output / "asset-manifest.json").read_text(encoding="utf-8"))
        self.assertTrue(asset_manifest)
        self.assertTrue(all("." in Path(value).stem for value in asset_manifest.values()))
        self.assertTrue(all((self.output / value).is_file() for value in asset_manifest.values()))
        built_html = (self.output / "index.html").read_text(encoding="utf-8")
        self.assertIn(asset_manifest["assets/runtime-config.js"], built_html)
        self.assertNotIn('src="assets/js/catalog.js"', built_html)
        performance = json.loads((self.output / "performance-budget-report.json").read_text(encoding="utf-8"))
        self.assertEqual(performance["status"], "passed")
        verification_dir = self.output / ".well-known" / "teo-verification"
        self.assertEqual(
            {
                path.name: path.read_text(encoding="utf-8").strip()
                for path in verification_dir.iterdir()
                if path.is_file()
            },
            {
                "fp8muni2ew.txt": "sl8saatid7b97j02mfs2yxbpnoyv52tv",
                "s13g6oebjj.txt": "pzqv0hdtvdndremvzg4thmc3u9q9t7rs",
            },
        )

        denied = {
            "_cfd_part1.json",
            "_ext_part1.json",
            "macro_raw.json",
            "policies_baseline.json",
            "rules_baseline.json",
            "alerts_detailed.json",
            "quarantine_future_records.json",
            "quarantine_unverified_baseline.json",
            "us_market/cpsc_recalls.json",
            "us_market/index.json",
            "us_market/electronics.json",
            "_sync_logs/sync_20260819_092403.json",
        }
        self.assertTrue(denied.isdisjoint(actual))

    def test_public_records_match_quality_report_formal_counts(self):
        quality = self.read_public_json("quality_report.json")
        counts = {
            "countries": len(self.read_public_json("countries.json")),
            "platforms": len(self.read_public_json("platforms.json")),
            "policies": len(self.read_public_json("policies.json")["items"]),
            "rules": len(self.read_public_json("rules.json")["items"]),
            "alerts": len(self.read_public_json("alerts.json")),
            "taxes": len(self.read_public_json("taxes.json")["items"]),
            "access_requirements": len(self.read_public_json("access_requirements.json")["items"]),
            "macro": len(self.read_public_json("us_market/macro_indicators.json")["indicators"]),
        }
        for key, count in counts.items():
            self.assertEqual(count, quality["datasets"][key]["formal_records"], key)
            self.assertEqual(count, self.manifest["datasets"][key]["published_records"], key)

    def test_public_fact_records_exclude_non_formal_states(self):
        records = []
        for filename in ("policies.json", "rules.json", "taxes.json", "access_requirements.json"):
            records.extend(self.read_public_json(filename)["items"])
        for row in self.read_public_json("alerts.json"):
            records.append(row[9])
        records.extend(self.read_public_json("us_market/macro_indicators.json")["indicators"].values())

        self.assertGreater(len(records), 0)
        self.assertTrue(all(record.get("verification_status") in {"verified", "uploaded"} for record in records))
        self.assertTrue(all(record.get("source_kind") != "demo" for record in records))
        self.assertTrue(all(not is_industry_advisory(record) for record in records))

    def test_workflow_uses_public_builder_instead_of_copying_data_directory(self):
        workflow = (ROOT / ".github" / "workflows" / "deploy-production.yml").read_text(encoding="utf-8")
        self.assertIn("python scripts/build_public_site.py --output _site --environment production", workflow)
        self.assertNotRegex(workflow, r"cp\s+-R\s+assets\s+data\s+_site")

    def test_pages_deployment_receives_the_validated_production_site_url(self):
        workflow = (ROOT / ".github" / "workflows" / "deploy-production.yml").read_text(encoding="utf-8")
        self.assertIn(
            "production_site_url: ${{ steps.release_context.outputs.production_site_url }}",
            workflow,
        )
        self.assertIn(
            "PRODUCTION_SITE_URL: ${{ needs.authenticated-acceptance.outputs.production_site_url }}",
            workflow,
        )
        self.assertIn('echo "production_site_url=$PRODUCTION_SITE_URL" >> "$GITHUB_OUTPUT"', workflow)

    def test_builder_rejects_nonempty_output_to_prevent_stale_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "site"
            output.mkdir()
            (output / "stale.json").write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError):
                build_public_site.build_public_site(output, ROOT)

    def test_production_builder_requires_environment_specific_public_config(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "site"
            with self.assertRaises(ValueError):
                build_public_site.build_public_site(
                    output,
                    ROOT,
                    environment="production",
                    environ={},
                )

    def test_production_builder_injects_config_and_csp_only_into_output(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "site"
            build_public_site.build_public_site(
                output,
                ROOT,
                environment="production",
                environ={
                    "SUPABASE_URL": "https://project.supabase.co",
                    "SUPABASE_ANON_KEY": "sb_publishable_test",
                },
            )
            asset_manifest = json.loads((output / "asset-manifest.json").read_text(encoding="utf-8"))
            runtime = (output / asset_manifest["assets/runtime-config.js"]).read_text(encoding="utf-8")
            self.assertIn("https://project.supabase.co", runtime)
            self.assertIn("sb_publishable_test", runtime)
            self.assertIn('"privacyPolicy":"2026-08-26"', runtime)
            self.assertIn('"termsOfService":"2026-08-26"', runtime)
            self.assertIn("https://project.supabase.co", (output / "index.html").read_text(encoding="utf-8"))
            self.assertNotIn("https://project.supabase.co", (ROOT / "index.html").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
