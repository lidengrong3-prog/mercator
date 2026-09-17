import json
import json
import os
import sys
import tempfile
import unittest
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import collect_cpsc  # noqa: E402
import collect_data  # noqa: E402
import collect_us_macro  # noqa: E402
from quarantine_unverified_baseline import is_unverified  # noqa: E402


class CollectorTests(unittest.TestCase):
    def test_cpsc_categories_are_limited_to_manifest_catalog(self):
        self.assertEqual(collect_cpsc.categorize_recall("Dog food recall"), "pet-food")
        self.assertEqual(collect_cpsc.categorize_recall("Pet leash recall"), "pet-supplies")
        self.assertEqual(collect_cpsc.categorize_recall("Toy scooter recall"), "generic")
        self.assertTrue(set(collect_cpsc.CATEGORY_MAP) <= collect_cpsc._SCOPE_CATEGORY_CODES)

    def test_query_url_encodes_unicode_spaces_and_repeated_fields(self):
        url = collect_data.build_query_url(
            "https://example.test/search?existing=1",
            [("q", "美国 电商"), ("fields[]", "title"), ("fields[]", "abstract")],
        )
        self.assertNotIn("美国", url)
        self.assertNotIn(" ", url)
        self.assertEqual(parse_qs(urlsplit(url).query), {
            "existing": ["1"],
            "q": ["美国 电商"],
            "fields[]": ["title", "abstract"],
        })

    def test_configured_collection_scope_excludes_schema_only_markets(self):
        scope = collect_data.configured_collection_scope({
            "config_version": "test",
            "markets": [
                {"code": "US", "status": "active", "data_status": "configured"},
                {"code": "ID", "status": "active", "data_status": "schema_only"},
            ],
            "platforms": [
                {"key": "amazon", "name": "Amazon"},
                {"key": "shopee", "name": "Shopee"},
            ],
            "market_platforms": [
                {"market_code": "US", "platform_key": "amazon", "status": "active", "data_status": "configured"},
                {"market_code": "ID", "platform_key": "shopee", "status": "active", "data_status": "schema_only"},
            ],
        })
        self.assertEqual(scope["market_codes"], ["US"])
        self.assertEqual(scope["platform_keys"], ["amazon"])
        self.assertEqual(scope["platform_names"], ["Amazon"])

    def test_configured_collection_scope_uses_manifest_category_codes(self):
        scope = collect_data.configured_collection_scope({
            "markets": [{
                "code": "US", "status": "active", "data_status": "configured",
                "category_keys": ["electronics", "pet-food", "pet-supplies"],
            }],
            "platforms": [{"key": "amazon", "name": "Amazon"}],
            "market_platforms": [{
                "market_code": "US", "platform_key": "amazon",
                "status": "active", "data_status": "configured",
            }],
            "categories": [
                {"code": "electronics", "status": "active"},
                {"code": "pet-food", "status": "active"},
                {"code": "pet-supplies", "status": "active"},
                {"code": "retired", "status": "inactive"},
            ],
        })

        self.assertEqual(scope["category_keys"], ["electronics", "pet-food", "pet-supplies"])

    def test_core_source_http_failure_is_retained_in_collection_report(self):
        collect_data.reset_collection_telemetry({"market_codes": ["US"]})
        url = collect_data.build_query_url(
            "https://example.test/search", {"q": "美国 电商"}
        )
        with patch.object(collect_data, "urlopen", side_effect=RuntimeError("offline")):
            result = collect_data.fetch_json(
                url,
                source_key="official_policy",
                source_label="Official policy source",
                domain="policy",
                core=True,
                market_codes=["US"],
            )
        report = collect_data.build_collection_report()
        self.assertIsNone(result)
        self.assertEqual(report["status"], "failed")
        self.assertEqual(report["summary"]["core_failures"], ["official_policy"])
        source = report["sources"][0]
        self.assertEqual(source["status"], "failed")
        self.assertEqual(source["request_count"], 1)
        self.assertEqual(source["failed_requests"], 1)
        self.assertGreaterEqual(source["duration_ms"], 0)

    def test_partial_source_success_advances_check_but_total_failure_does_not(self):
        collect_data.reset_collection_telemetry({"market_codes": ["US"]})
        partial = collect_data.register_collection_source(
            "partial", "Partial official source", "rule", core=True
        )
        partial["collector_status"] = "succeeded"
        collect_data._record_http_result(partial, success=True, duration_ms=1)
        collect_data._record_http_result(
            partial, success=False, duration_ms=1, error="secondary endpoint unavailable"
        )
        failed = collect_data.register_collection_source(
            "failed", "Failed official source", "rule", core=True
        )
        failed["collector_status"] = "succeeded"
        collect_data._record_http_result(
            failed, success=False, duration_ms=1, error="offline"
        )

        self.assertTrue(collect_data.collection_source_checked("partial"))
        self.assertFalse(collect_data.collection_source_checked("failed"))

    def test_country_catalog_timestamp_advances_after_real_macro_update(self):
        generated_at = "2026-09-10T10:30:00+00:00"
        macro_data = {
            "meta": {"generated_at": generated_at},
            "indicators": {
                "UNRATE": {
                    "date": "2026-08-01", "value": "4.2", "unit": "%",
                    "source": "FRED", "source_url": "https://fred.stlouisfed.org/series/UNRATE",
                },
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "countries.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump({
                    "us": {"macro": []},
                    "_metadata": {"last_updated": "2026-08-01T00:00:00+00:00", "updated_countries": []},
                }, handle)
            self.assertTrue(collect_us_macro.update_countries_json(macro_data, path))
            with open(path, encoding="utf-8") as handle:
                countries = json.load(handle)

        self.assertEqual(countries["_metadata"]["last_updated"], generated_at)
        self.assertIn("us", countries["_metadata"]["updated_countries"])
        self.assertTrue(countries["us"]["macro"])

    def test_main_uses_only_configured_scope_and_skips_legacy_global_writes(self):
        manifest = {
            "config_version": "test",
            "markets": [
                {"code": "US", "status": "active", "data_status": "configured"},
                {"code": "ID", "status": "active", "data_status": "schema_only"},
            ],
            "platforms": [
                {"key": "amazon", "name": "Amazon"},
                {"key": "tiktok-shop", "name": "TikTok Shop"},
                {"key": "aliexpress", "name": "AliExpress"},
                {"key": "ebay", "name": "eBay"},
                {"key": "shopee", "name": "Shopee"},
            ],
            "market_platforms": [
                {"market_code": "US", "platform_key": key, "status": "active", "data_status": "configured"}
                for key in ("amazon", "tiktok-shop", "aliexpress", "ebay")
            ] + [
                {"market_code": "ID", "platform_key": "shopee", "status": "active", "data_status": "schema_only"}
            ],
        }
        policy = {
            "id": "policy-1", "title": "US policy", "source": "Federal Register",
            "summary": "Current policy summary.",
            "source_url": "https://www.federalregister.gov/documents/1",
            "published_at": collect_data.NOW_DATE,
        }
        with tempfile.TemporaryDirectory() as directory:
            with open(os.path.join(directory, "market_scope.json"), "w", encoding="utf-8") as handle:
                json.dump(manifest, handle)
            with patch.object(collect_data, "DATA_DIR", directory), \
                    patch.object(collect_data, "collect_federal_register", return_value=[policy]), \
                    patch.object(collect_data, "collect_ustr", return_value=[]), \
                    patch.object(collect_data, "collect_cn_news", return_value=[]), \
                    patch.object(collect_data, "collect_amazon", return_value=[]), \
                    patch.object(collect_data, "collect_tiktok_shop", return_value=[]):
                self.assertEqual(collect_data.main(), 0)

            with open(os.path.join(directory, "collection_run.json"), encoding="utf-8") as handle:
                run = json.load(handle)
            with open(os.path.join(directory, "policies.json"), encoding="utf-8") as handle:
                policies = json.load(handle)
        self.assertEqual(run["scope"]["market_codes"], ["US"])
        self.assertEqual(
            run["scope"]["platform_keys"],
            ["amazon", "tiktok-shop", "aliexpress", "ebay"],
        )
        self.assertFalse(run["legacy_global_writes"])
        self.assertNotIn("shopee", run["scope"]["platform_keys"])
        self.assertEqual(policies["items"][0]["market_codes"], ["US"])
        self.assertFalse(hasattr(collect_data, "collect_platform_updates"))
        self.assertFalse(hasattr(collect_data, "collect_country_updates"))

    def test_industry_advisory_is_traceable_but_not_official(self):
        item = collect_data.annotate_industry_advisory({
            "title": "美国站新关税提醒",
            "summary": "美国跨境卖家需要关注进口费用变化。",
            "source": "雨果网",
            "source_url": "https://www.cifnews.com/article/123456",
            "region": "Global",
            "published_at": "2026-08-30",
        })
        self.assertEqual(item["source_kind"], "traceable")
        self.assertEqual(item["source_type"], "licensed_provider")
        self.assertEqual(item["source_class"], "industry_advisory")
        self.assertEqual(item["verification_status"], "pending")
        self.assertEqual(item["market_codes"], ["US"])
        self.assertNotIn("verified_at", item)

    def test_industry_market_detection_does_not_assume_global_scope(self):
        self.assertEqual(
            collect_data.infer_industry_market_codes("美国关税变化"),
            ["US"],
        )
        self.assertEqual(
            collect_data.infer_industry_market_codes("全球跨境电商趋势"),
            [],
        )
        record = {"title": "平台费用变化", "summary": "美国站卖家需要关注。"}
        collect_data.refresh_industry_market_scope(record)
        self.assertEqual(record["market_codes"], ["US"])
        self.assertEqual(record["market_scope_status"], "identified")

    def test_industry_market_detection_ignores_lowercase_url_parameter_codes(self):
        text = (
            "Worldfirst注册教程 "
            "https://example.com/?affiliate_id=8053&referral_id=8053"
        )
        self.assertEqual(collect_data.infer_industry_market_codes(text), [])

    def test_industry_market_detection_uses_future_market_aliases(self):
        with tempfile.TemporaryDirectory() as directory:
            with open(os.path.join(directory, "market_scope.json"), "w", encoding="utf-8") as handle:
                json.dump({
                    "markets": [
                        {
                            "code": "DE", "key": "de", "name": "德国", "label": "德国市场",
                            "aliases": ["germany"], "region_code": "EU", "region_name": "欧洲",
                        },
                        {
                            "code": "US", "key": "us", "name": "美国", "label": "美国市场",
                            "aliases": ["united states"], "region_code": "NA", "region_name": "北美",
                        },
                    ]
                }, handle, ensure_ascii=False)
            with patch.object(collect_data, "DATA_DIR", directory):
                self.assertEqual(
                    collect_data.infer_industry_market_codes("德国卖家平台费用调整"),
                    ["DE"],
                )
                self.assertEqual(
                    collect_data.infer_industry_market_codes("欧盟跨境电商进口要求"),
                    ["DE"],
                )
                record = {"market_codes": ["德国"], "title": "平台规则变化"}
                collect_data.refresh_industry_market_scope(record)
                self.assertEqual(record["market_codes"], ["DE"])
                record = {"market_codes": ["EU"], "title": "平台规则变化"}
                collect_data.refresh_industry_market_scope(record)
                self.assertEqual(record["market_codes"], ["EU", "DE"])

    def test_cn_news_keeps_both_providers_as_advisory_records(self):
        cifnews_html = (
            '<a href="https://www.cifnews.com/article/1">美国跨境电商关税新规提醒</a>'
        )
        amz123_html = '<a href="/t/2">美国 FBA 费用调整</a>'
        with patch.object(collect_data, "fetch_html", side_effect=[cifnews_html, amz123_html]):
            items = collect_data.collect_cn_news()
        self.assertEqual([item["source"] for item in items], ["雨果网", "AMZ123"])
        self.assertTrue(all(item["source_class"] == "industry_advisory" for item in items))
        self.assertTrue(all(item["verification_status"] == "pending" for item in items))
        self.assertTrue(all(item["market_codes"] == ["US"] for item in items))

    def test_cn_news_reads_absolute_amz123_links_with_nested_titles(self):
        cifnews_html = ''
        amz123_html = (
            '<a href="https://www.amz123.com/t/2" class="amz-container">'
            '<img alt="图标"><span>美国 FBA 费用调整</span></a>'
        )
        with patch.object(collect_data, "fetch_html", side_effect=[cifnews_html, amz123_html]):
            items = collect_data.collect_cn_news()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["source"], "AMZ123")
        self.assertEqual(items[0]["source_url"], "https://www.amz123.com/t/2")
        self.assertEqual(items[0]["market_codes"], ["US"])

    def test_cpsc_normalizes_official_fields_and_links(self):
        raw = [{
            "RecallID": 1,
            "RecallNumber": "R-1",
            "RecallDate": "2026-08-20T00:00:00",
            "Title": "Portable charger recall",
            "Description": "The battery can overheat.",
            "URL": "https:/www.cpsc.gov/Recalls/2026/example",
            "ManufacturerCountries": [{"Country": "China"}],
            "Products": [{"Name": "Portable charger"}],
            "Hazards": [{"Name": "Fire hazard"}],
        }]
        output = collect_cpsc.process_recalls(raw, days=120)
        self.assertEqual(output["meta"]["total_recalls"], 1)
        item = output["recalls"][0]
        self.assertEqual(item["id"], "cpsc-e55b177f")
        self.assertEqual(item["url"], "https://www.cpsc.gov/Recalls/2026/example")
        self.assertEqual(item["manufacturer_countries"], ["China"])
        self.assertTrue(item["china_related"])

    def test_unverified_baseline_requires_source_evidence(self):
        self.assertTrue(is_unverified({"title": "Sample", "data_quality": "demonstration"}))
        self.assertTrue(is_unverified({"title": "Sample", "source_verified": False}))
        self.assertTrue(is_unverified({"title": "Sample", "source_url": ""}))
        self.assertFalse(is_unverified({"title": "Real", "source_url": "https://example.gov/rule"}))

    def test_platform_rule_parser_handles_links_and_json_ld_without_homepage_sources(self):
        html = (
            '<a href="/news/fee-update" data-date="2026-09-01">FBA fee update</a>'
            '<a href="/ap/register?return=/help">创建您的亚马逊账户</a>'
            '<script type="application/ld+json">'
            '{"headline":"Seller penalty update","url":"https://sellercentral.amazon.com/news/penalty",'
            '"datePublished":"2026-09-02"}</script>'
        )
        rows = collect_data._extract_platform_rule_records(
            html, "https://sellercentral.amazon.com/news", "amazon", "Amazon"
        )
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["source_url"].startswith("https://") for row in rows))
        self.assertTrue(all("/" in row["source_url"].split(".com", 1)[-1] for row in rows))
        self.assertTrue(all(row["verification_status"] == "verified" for row in rows))

    def test_ebay_rule_parser_rejects_navigation_and_uses_card_heading(self):
        html = (
            '<a href="/adchoice">AdChoice</a>'
            '<a href="/help/home">Help &amp; Contact</a>'
            '<a href="/mye/myebay/watchlist">Watchlist</a>'
            '<a href="/help/policies/technical-issues/technical-issues?id=4220">'
            '<h3>customer service page</h3></a>'
            '<a href="/help/selling/getting-paid/getting-paid-items-youve-sold?id=4814">'
            '<h3>Getting paid for items you have sold</h3><p>Account payout details.</p></a>'
            '<a href="/help/policies/member-behaviour-policies/user-agreement?id=4259">'
            '<h3>User Agreement</h3></a>'
        )
        rows = collect_data._extract_platform_rule_records(
            html, "https://www.ebay.com/help/selling", "ebay", "eBay"
        )
        self.assertEqual(
            [row["title"] for row in rows],
            ["Getting paid for items you have sold", "User Agreement"],
        )
        self.assertTrue(all("/help/" in row["source_url"] for row in rows))

    def test_browser_rule_normalization_adds_a_record_id(self):
        row = collect_data.normalize_platform_rule({
            "rule_key": "tiktok-shop:6061866251044609",
            "title": "US policy update",
            "source_url": (
                "https://seller.tiktokshopglobalselling.com/university/essay"
                "?knowledge_id=6061866251044609"
            ),
        }, platform_key="tiktok-shop", market_code="US")
        self.assertRegex(row["id"], r"^r\d{8}-[0-9a-f]{8}$")
        self.assertEqual(row["source_record_id"], "tiktok-shop:6061866251044609")
        self.assertEqual(row["source_id_method"], "url_query")
        self.assertTrue(row["source_id_is_official"])

    def test_platform_source_ids_are_extracted_from_official_urls(self):
        ebay = collect_data.normalize_platform_rule({
            "title": "Seller fees",
            "source_url": "https://www.ebay.com/help/selling/fees?id=4079&campid=tracking",
        }, platform_key="ebay", market_code="US")
        ebay_locale = collect_data.normalize_platform_rule({
            "title": "Seller fees renamed",
            "source_url": "https://www.ebay.com/help/selling/fees?locale=en_US&id=4079",
        }, platform_key="ebay", market_code="US")
        amazon = collect_data.normalize_platform_rule({
            "title": "Amazon help reference",
            "source_url": "https://sellercentral.amazon.com/help/hub/reference/G200164330?ref_=abc",
        }, platform_key="amazon", market_code="US")
        self.assertEqual(ebay["source_record_id"], "ebay:4079")
        self.assertEqual(ebay["rule_key"], "ebay:4079")
        self.assertEqual(collect_data._rule_identity(ebay), collect_data._rule_identity(ebay_locale))
        self.assertEqual(amazon["source_record_id"], "amazon:G200164330")

    def test_internal_fallback_never_masquerades_as_a_source_record_id(self):
        row = collect_data.normalize_platform_rule({
            "title": "Unverified imported rule",
            "source_url": "https://example.test/rules/123",
            "verification_status": "verified",
            "verified_at": "2026-09-12T00:00:00Z",
        }, platform_key="amazon", market_code="US")
        row = collect_data.annotate_provenance(row)
        self.assertTrue(row["rule_key"])
        self.assertEqual(row["source_record_id"], "")
        self.assertEqual(row["source_id_method"], "internal_fallback")
        self.assertFalse(row["source_id_is_official"])
        self.assertEqual(row["verification_status"], "pending")
        self.assertFalse(collect_data._is_formal_platform_rule(row))

    def test_rule_dimensions_require_explicit_text_evidence(self):
        row = collect_data.normalize_platform_rule({
            "title": "Brand authorization compliance requirements",
            "summary": "未取得授权的商品可能被下架，平台也可能限制商品发布权限或采取其他处置措施。",
            "source_url": "https://seller.tiktokshopglobalselling.com/university/essay?knowledge_id=4315917970491137",
        }, platform_key="tiktok-shop", market_code="US")
        self.assertEqual(set(row["rule_dimensions"]), {"prohibited", "penalty"})
        generic = collect_data.normalize_platform_rule({
            "title": "Monthly policy update",
            "summary": "Read the latest seller news.",
            "source_url": "https://seller.tiktokshopglobalselling.com/university/essay?knowledge_id=6061866251044609",
        }, platform_key="tiktok-shop", market_code="US")
        self.assertEqual(generic["rule_dimensions"], {})

    def test_rule_version_diff_and_stable_identity(self):
        previous = collect_data.normalize_platform_rule({
            "platform": "Amazon", "market": "US", "rule_key": "fees-1",
            "title": "Fee", "fee": "$1", "source_url": "https://sellercentral.amazon.com/news/fee",
            "verification_status": "verified", "verified_at": "2026-09-01T00:00:00Z",
        })
        current = collect_data.normalize_platform_rule({
            "platform": "Amazon", "market": "US", "rule_key": "fees-1",
            "title": "Fee", "fee": "$2", "source_url": "https://sellercentral.amazon.com/news/fee",
            "verification_status": "verified", "verified_at": "2026-09-02T00:00:00Z",
        })
        diff = collect_data.compare_rule_versions(previous, current)
        self.assertEqual(diff["changed_fields"], ["fee"])
        self.assertEqual(collect_data._rule_identity(previous), collect_data._rule_identity(current))

        original_by_url = collect_data.normalize_platform_rule({
            "platform": "Amazon", "market": "US", "title": "Fee policy",
            "fee": "$1", "source_url": "https://sellercentral.amazon.com/news/fee?locale=en_US",
            "verification_status": "verified", "verified_at": "2026-09-01T00:00:00Z",
        })
        renamed = collect_data.normalize_platform_rule({
            "platform": "Amazon", "market": "US", "title": "Fee policy revised",
            "fee": "$3", "source_url": "https://sellercentral.amazon.com/news/fee?locale=en_US",
            "verification_status": "verified", "verified_at": "2026-09-03T00:00:00Z",
        })
        self.assertEqual(collect_data._rule_identity(original_by_url), collect_data._rule_identity(renamed))

    def test_platform_coverage_does_not_use_directory_configuration(self):
        rows = [{
            "platform": "Amazon", "platform_key": "amazon", "market": "US",
            "rule_key": "r-1", "title": "Fee", "topic": "fee",
            "source_url": "https://sellercentral.amazon.com/news/fee",
            "verification_status": "verified", "verified_at": "2026-09-12T00:00:00Z",
        }]
        coverage = collect_data.build_platform_rule_coverage(
            rows, ["amazon", "aliexpress"], now=collect_data.datetime(2026, 9, 13, tzinfo=collect_data.timezone.utc)
        )
        self.assertEqual(coverage["amazon"]["status"], "partial")
        self.assertEqual(coverage["aliexpress"]["status"], "not_connected")
        self.assertEqual(coverage["amazon"]["dimensions"]["fee"]["status"], "connected")
        self.assertEqual(coverage["amazon"]["dimensions"]["fee"]["source_record_ids"], [
            "amazon:path:news/fee"
        ])
        self.assertEqual(coverage["aliexpress"]["dimensions"]["fee"]["status"], "not_connected")

    def test_public_platform_collectors_run_without_directory_fallbacks(self):
        with patch.object(collect_data, "fetch_html", return_value="<html><a href='/'>Home</a></html>") as fetch:
            self.assertEqual(collect_data.collect_aliexpress(), [])
            self.assertEqual(collect_data.collect_ebay(), [])
            self.assertEqual(fetch.call_count, 4)

    def test_browser_rule_fallback_is_opt_in_and_returns_bounded_records(self):
        payload = [{
            "rule_key": "tiktok-shop:123", "title": "US seller fee update",
            "source_url": "https://seller.tiktokshopglobalselling.com/university/essay?knowledge_id=123",
        }]
        completed = type("Completed", (), {
            "returncode": 0, "stdout": json.dumps(payload), "stderr": "",
        })()
        with patch.dict(os.environ, {
            "ENABLE_BROWSER_PLATFORM_RULES": "true",
            "PLATFORM_BROWSER_TIMEOUT_SECONDS": "30",
        }, clear=False), patch.object(collect_data.subprocess, "run", return_value=completed) as run:
            rows = collect_data._browser_rendered_platform_rules(
                "tiktok-shop", "https://seller.tiktokshopglobalselling.com/university/new-policies"
            )
        self.assertEqual(rows, payload)
        self.assertEqual(run.call_args.kwargs["timeout"], 30)
        self.assertTrue(run.call_args.kwargs["capture_output"])

    def test_empty_reachable_core_rule_page_is_degraded(self):
        collect_data.reset_collection_telemetry({"market_codes": ["US"]})
        with patch.dict(os.environ, {"ENABLE_BROWSER_PLATFORM_RULES": ""}, clear=False), \
                patch.object(collect_data, "fetch_html", return_value="<html><body>app shell</body></html>"):
            rows = collect_data.run_collection_source(
                "tiktok_shop_rules", "TikTok Shop Seller Center", "rule",
                collect_data.collect_tiktok_shop, core=True,
                market_codes=["US"], platform_keys=["tiktok-shop"],
            )
        self.assertEqual(rows, [])
        self.assertEqual(
            collect_data._source_status(collect_data.COLLECTION_SOURCES["tiktok_shop_rules"]),
            "degraded",
        )


if __name__ == "__main__":
    unittest.main()
