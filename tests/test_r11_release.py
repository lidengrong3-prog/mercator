import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlparse

from scripts.build_release_bundle import CRITICAL_ASSETS, build_release_bundle
from scripts import verify_dual_release
from scripts.verify_dual_release import DualReleaseError, digest, validate_expected, verify_once


class R11ReleaseTests(unittest.TestCase):
    def make_site(self, root: Path) -> Path:
        site = root / "site"
        site.mkdir()
        asset_manifest = {}
        for index, logical in enumerate(CRITICAL_ASSETS):
            logical_path = Path(logical)
            deployed = logical_path.with_name(f"{logical_path.stem}.r11{index}{logical_path.suffix}").as_posix()
            target = site / deployed
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(f"asset:{logical}\n", encoding="utf-8")
            asset_manifest[logical] = deployed
        files = {
            "index.html": "<!doctype html><title>JAY R11</title>\n",
            "public-data-manifest.json": '{"policy":"explicit-allowlist-formal-projection"}\n',
            "edgeone.json": '{"headers":[]}\n',
            "middleware.js": "export function middleware() {}\n",
        }
        for name, content in files.items():
            (site / name).write_text(content, encoding="utf-8")
        (site / "asset-manifest.json").write_text(
            json.dumps(asset_manifest, sort_keys=True) + "\n", encoding="utf-8"
        )
        (site / "edgeone-rules-source.json").write_text(json.dumps({
            "schema_version": 1,
            "authority": "repository-build-artifact",
            "manual_overrides_allowed": False,
            "source_files": ["edgeone.json", "deploy/edgeone-middleware.js"],
            "deployed_files": {},
        }) + "\n", encoding="utf-8")
        return site

    def test_build_release_bundle_captures_identity_and_critical_resources(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            site = self.make_site(Path(temp_dir))
            result = build_release_bundle(
                site,
                release_sha="a" * 40,
                migration_head="20261020000000_r11",
                production_origin="https://example.com/",
                source_ref="main",
            )
            validate_expected(result)
            release = json.loads((site / "release.json").read_text(encoding="utf-8"))
            self.assertEqual(release["schema_version"], 2)
            self.assertEqual(release["frontend"], "github-pages+edgeone-pages")
            self.assertEqual(release["asset_manifest_sha256"], result["resources"]["asset-manifest.json"]["sha256"])
            for logical in CRITICAL_ASSETS:
                deployed = json.loads((site / "asset-manifest.json").read_text(encoding="utf-8"))[logical]
                self.assertIn(deployed, result["resources"])

    def test_live_dual_probe_requires_identical_artifacts_and_repository_rules(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            site = self.make_site(Path(temp_dir))
            expected = build_release_bundle(
                site,
                release_sha="b" * 40,
                migration_head="20261020000000_r11",
                production_origin="https://example.com",
                source_ref="main",
            )
            expected_raw = (site / "release-integrity.json").read_bytes()

            def fake_fetch(url, *, resolve_ip=None):
                path = urlparse(url).path.lstrip("/")
                if path == "data/_r11_private_probe.json":
                    return 404, b"Not Found\n", {"cache-control": "no-store"}
                payload = (site / path).read_bytes()
                headers = {}
                if path == "index.html" and resolve_ip is None:
                    headers["x-jay-edgeone-rules-source"] = "repository-build-artifact"
                return 200, payload, headers

            with patch.object(verify_dual_release, "curl_fetch", side_effect=fake_fetch):
                result = verify_once(
                    expected,
                    digest(expected_raw),
                    "https://example.com/",
                    "https://example.com/",
                    ("185.199.108.153",),
                )
            self.assertEqual(result["status"], "passed")
            self.assertEqual(result["evidence_source"], "live_http")
            self.assertFalse(result["mock_used"])
            self.assertEqual(result["differences"], [])
            self.assertTrue(result["surfaces"]["github_pages"]["direct_origin"])

    def test_dual_probe_rejects_a_surface_fingerprint_difference(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            site = self.make_site(Path(temp_dir))
            expected = build_release_bundle(
                site,
                release_sha="c" * 40,
                migration_head="20261020000000_r11",
                production_origin="https://example.com",
                source_ref="main",
            )
            expected_raw = (site / "release-integrity.json").read_bytes()

            def fake_fetch(url, *, resolve_ip=None):
                path = urlparse(url).path.lstrip("/")
                if path == "data/_r11_private_probe.json":
                    return 404, b"Not Found\n", {"cache-control": "no-store"}
                payload = (site / path).read_bytes()
                if path == "index.html" and resolve_ip is None:
                    return 200, payload + b"manual override", {"x-jay-edgeone-rules-source": "repository-build-artifact"}
                return 200, payload, {}

            with patch.object(verify_dual_release, "curl_fetch", side_effect=fake_fetch):
                with self.assertRaises(DualReleaseError):
                    verify_once(
                        expected,
                        digest(expected_raw),
                        "https://example.com/",
                        "https://example.com/",
                        ("185.199.108.153",),
                    )


if __name__ == "__main__":
    unittest.main()
