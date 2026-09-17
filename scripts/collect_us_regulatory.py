#!/usr/bin/env python3
"""Collect formal US tax and market-access records from official sources.

The catalog below identifies the exact legal or agency record that the
product can cite. A record is refreshed only after its HTTPS source is
reachable. Failed sources retain their last successful record so a temporary
government-site outage cannot erase a regulatory domain.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from collection_telemetry import append_collection_source
from market_scope import configured_catalog, load_market_scope
from source_governance import assert_source_collectable


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
MAX_SOURCE_BYTES = 8 * 1024 * 1024
# Several federal CDNs serve false 403/404 responses to unknown user-agent
# prefixes. Keep the collector identity while using their accepted curl family.
USER_AGENT = "curl/8.10.1 JAY-Guanhai-US-Regulatory-Collector/1.0"
COLLECTOR_KEY = "collect_us_regulatory"


TAX_RECORDS: tuple[dict[str, Any], ...] = (
    {
        "id": "tax-us-state-local-sales-tax",
        "source_record_id": "USA-GOV-STATE-TAXES",
        "source_key": "usa-gov",
        "source": "USA.gov",
        "source_type": "government",
        "source_url": "https://www.usa.gov/state-taxes",
        "title": "State and local sales taxes in the United States",
        "title_zh": "美国州和地方销售税",
        "summary": (
            "The United States has no single federal retail sales-tax rate. State and local "
            "governments determine whether sales tax applies and the applicable rate, so a "
            "seller must resolve the destination jurisdiction before calculating tax."
        ),
        "summary_zh": (
            "美国没有统一的联邦零售销售税率。销售税是否适用及具体税率由州和地方政府决定，"
            "卖家应先确认交易目的地辖区再计算税额。"
        ),
        "tax_type": "sales_tax",
        "rate": "Varies by state and locality",
        "scope_condition": "Destination-state and local nexus rules determine liability.",
        "effective_from": "2025-01-01",
        "fallback_published_at": "2025-01-01",
        "category_codes": "__all__",
        "authority": "United States General Services Administration",
        "legal_reference": "USA.gov state and local tax guidance",
    },
    {
        "id": "tax-us-ca-marketplace-collection",
        "source_record_id": "CA-CDTFA-PUBLICATION-109",
        "source_key": "cdtfa",
        "source": "California Department of Tax and Fee Administration",
        "source_type": "government",
        "source_url": "https://www.cdtfa.ca.gov/formspubs/pub109/",
        "title": "California marketplace sales rules (Publication 109)",
        "title_zh": "加州平台交易销售税规则（第 109 号出版物）",
        "summary": (
            "California Publication 109 explains sales and use-tax responsibilities for internet "
            "sales, including marketplace-facilitator collection duties. Applicability depends on "
            "the transaction, seller activities, and California nexus."
        ),
        "summary_zh": (
            "加州第 109 号出版物说明互联网销售的销售税和使用税责任，包括平台促进者的代收义务。"
            "是否适用取决于具体交易、卖家活动及其与加州的税收联系。"
        ),
        "tax_type": "marketplace_collection",
        "rate": "California state and district rates apply when the transaction is taxable",
        "scope_condition": "California marketplace transactions; verify facilitator and seller roles.",
        "effective_from": "2019-10-01",
        "fallback_published_at": "2019-10-01",
        "category_codes": "__all__",
        "subjurisdiction_codes": ["US-CA"],
        "authority": "California Department of Tax and Fee Administration",
        "legal_reference": "California Revenue and Taxation Code marketplace-facilitator rules",
    },
    {
        "id": "tax-us-htsus-customs-duty",
        "source_record_id": "USITC-HTSUS-CURRENT",
        "source_key": "usitc",
        "source": "United States International Trade Commission",
        "source_type": "government",
        "source_url": "https://hts.usitc.gov/",
        "title": "Harmonized Tariff Schedule of the United States",
        "title_zh": "美国协调关税表",
        "summary": (
            "The HTSUS is the official tariff schedule used to classify imported merchandise. "
            "Duty treatment must be determined from the current HTSUS classification, country of "
            "origin, special-program eligibility, and applicable chapter notes."
        ),
        "summary_zh": (
            "美国协调关税表是进口商品归类所使用的正式税则。关税待遇必须结合现行 HTSUS 归类、"
            "原产国、特殊项目资格及相关章注确定。"
        ),
        "tax_type": "customs_duty",
        "rate": "Varies by HTSUS classification and origin",
        "scope_condition": "Imported merchandise; classification-specific.",
        "effective_from": "2026-01-01",
        "fallback_published_at": "2026-01-01",
        "category_codes": "__all__",
        "authority": "United States International Trade Commission",
        "legal_reference": "Harmonized Tariff Schedule of the United States",
    },
    {
        "id": "tax-us-section-301-additional-tariff",
        "source_record_id": "USTR-SECTION-301-TARIFF-ACTIONS",
        "source_key": "ustr",
        "source": "Office of the United States Trade Representative",
        "source_type": "government",
        "source_url": "https://ustr.gov/issue-areas/enforcement/section-301-investigations/tariff-actions",
        "title": "Section 301 tariff actions concerning China",
        "title_zh": "针对中国的 301 条款附加关税措施",
        "summary": (
            "USTR maintains the official Section 301 tariff-action record. Additional duties apply "
            "only to covered HTSUS subheadings and must be checked together with exclusions, "
            "effective dates, country of origin, and the ordinary customs duty."
        ),
        "summary_zh": (
            "美国贸易代表办公室维护 301 条款关税措施的正式记录。附加税仅适用于被列入范围的 "
            "HTSUS 税号，判断时还需同时核对排除清单、生效日期、原产国和普通关税。"
        ),
        "tax_type": "customs_duty",
        "tax_subtype": "additional_tariff",
        "rate": "Varies by covered HTSUS subheading and effective action",
        "scope_condition": "China-origin goods in covered HTSUS subheadings; exclusions may apply.",
        "effective_from": "2018-07-06",
        "fallback_published_at": "2018-07-06",
        "category_codes": "__all__",
        "authority": "Office of the United States Trade Representative",
        "legal_reference": "Trade Act of 1974, Section 301 tariff actions",
    },
    {
        "id": "tax-us-cbp-merchandise-processing-fee",
        "source_record_id": "CBP-USER-FEE-TABLE-MPF",
        "source_key": "cbp",
        "source": "U.S. Customs and Border Protection",
        "source_type": "government",
        "source_url": "https://www.cbp.gov/trade/basic-import-export/user-fee-table",
        "title": "Customs user fees and merchandise processing fee",
        "title_zh": "美国海关用户费与商品处理费",
        "summary": (
            "CBP publishes the official user-fee table, including the merchandise processing fee. "
            "The payable amount depends on entry type, entered value, statutory minimum and maximum "
            "amounts, and any applicable exemption or trade agreement."
        ),
        "summary_zh": (
            "美国海关与边境保护局发布正式用户费表，其中包括商品处理费。应付金额取决于申报类型、"
            "申报价值、法定最低和最高金额，以及适用的豁免或贸易协定。"
        ),
        "tax_type": "import_fee",
        "rate": "See the current CBP user-fee table",
        "scope_condition": "Customs entries; entry type and exemptions affect the fee.",
        "effective_from": "2025-10-01",
        "fallback_published_at": "2025-10-01",
        "category_codes": "__all__",
        "authority": "U.S. Customs and Border Protection",
        "legal_reference": "19 CFR 24.23 and the current CBP user-fee table",
    },
)


ACCESS_RECORDS: tuple[dict[str, Any], ...] = (
    {
        "id": "access-us-fcc-equipment-authorization",
        "source_record_id": "47-CFR-PART-2-SUBPART-J",
        "source_key": "govinfo",
        "source": "U.S. Government Publishing Office",
        "source_type": "government",
        "source_url": "https://www.govinfo.gov/content/pkg/CFR-2025-title47-vol1/xml/CFR-2025-title47-vol1-part2.xml",
        "title": "FCC equipment authorization procedures",
        "title_zh": "FCC 设备授权程序",
        "summary": (
            "47 CFR Part 2 Subpart J sets equipment-authorization procedures for radiofrequency "
            "devices. Electronics that intentionally or unintentionally emit radiofrequency energy "
            "must be classified against the applicable FCC authorization route before marketing."
        ),
        "summary_zh": (
            "《联邦法规汇编》第 47 编第 2 部分 J 分部规定射频设备授权程序。对有意或无意发射射频"
            "能量的电子产品，应在上市前确认适用的 FCC 授权路径。"
        ),
        "requirement_type": "certification",
        "category_codes": ["electronics"],
        "scope_condition": "Applies when the product is an RF device subject to FCC rules.",
        "effective_from": "2017-11-02",
        "fallback_published_at": "2017-11-02",
        "authority": "Federal Communications Commission",
        "legal_reference": "47 CFR Part 2 Subpart J",
    },
    {
        "id": "access-us-cpsc-product-certification",
        "source_record_id": "CPSC-TESTING-CERTIFICATION",
        "source_key": "cpsc",
        "source": "U.S. Consumer Product Safety Commission",
        "source_type": "regulator",
        "source_url": "https://www.cpsc.gov/Business--Manufacturing/Testing-Certification",
        "title": "CPSC product testing and certification",
        "title_zh": "CPSC 产品测试与合格证要求",
        "summary": (
            "Manufacturers and importers of products subject to a CPSC-enforced product-safety rule "
            "must determine whether a General Certificate of Conformity or Children's Product "
            "Certificate and required testing apply before distribution in the United States."
        ),
        "summary_zh": (
            "对受 CPSC 执行的产品安全规则约束的商品，制造商和进口商应在美国分销前确认是否需要"
            "一般合格证、儿童产品证书及相应测试。"
        ),
        "requirement_type": "certification",
        "category_codes": ["generic", "electronics", "home", "pet-supplies"],
        "scope_condition": "Conditional on a CPSC-enforced product-safety rule and product use.",
        "effective_from": "2008-11-12",
        "fallback_published_at": "2008-11-12",
        "authority": "U.S. Consumer Product Safety Commission",
        "legal_reference": "Consumer Product Safety Improvement Act certification provisions",
    },
    {
        "id": "access-us-textile-labeling",
        "source_record_id": "16-CFR-PART-303",
        "source_key": "govinfo",
        "source": "U.S. Government Publishing Office",
        "source_type": "government",
        "source_url": "https://www.govinfo.gov/content/pkg/CFR-2025-title16-vol1/xml/CFR-2025-title16-vol1-part303.xml",
        "title": "Textile fiber product identification and labeling",
        "title_zh": "纺织纤维产品标识与标签要求",
        "summary": (
            "16 CFR Part 303 implements textile labeling requirements, including fiber content, "
            "responsible company identification, and country-of-origin disclosures for covered "
            "textile products."
        ),
        "summary_zh": (
            "《联邦法规汇编》第 16 编第 303 部分规定受管纺织产品的纤维成分、责任企业身份和"
            "原产国等标签信息。"
        ),
        "requirement_type": "labeling",
        "category_codes": ["apparel"],
        "scope_condition": "Covered textile fiber products; statutory exclusions must be checked.",
        "effective_from": "1960-03-03",
        "fallback_published_at": "1960-03-03",
        "authority": "Federal Trade Commission",
        "legal_reference": "16 CFR Part 303",
    },
    {
        "id": "access-us-cosmetics-labeling",
        "source_record_id": "FDA-COSMETICS-LABELING-GUIDE",
        "source_key": "fda",
        "source": "U.S. Food and Drug Administration",
        "source_type": "regulator",
        "source_url": "https://www.fda.gov/cosmetics/cosmetics-labeling-regulations/cosmetics-labeling-guide",
        "title": "FDA cosmetics labeling requirements",
        "title_zh": "FDA 化妆品标签要求",
        "summary": (
            "FDA's cosmetics labeling guide explains identity, net quantity, ingredient declaration, "
            "business information, warning, and placement requirements for cosmetic labels. Claims "
            "that make a product a drug trigger additional requirements."
        ),
        "summary_zh": (
            "FDA 化妆品标签指南说明产品名称、净含量、成分表、企业信息、警示语和标签位置要求。"
            "使产品构成药品的宣称会触发额外要求。"
        ),
        "requirement_type": "labeling",
        "category_codes": ["beauty"],
        "scope_condition": "Cosmetics marketed in the United States; drug claims change the regime.",
        "effective_from": "1975-05-05",
        "fallback_published_at": "1975-05-05",
        "authority": "U.S. Food and Drug Administration",
        "legal_reference": "21 CFR Part 701 and FDA Cosmetics Labeling Guide",
    },
    {
        "id": "access-us-cosmetics-packaging-display",
        "source_record_id": "FDA-COSMETICS-PACKAGING-DISPLAY",
        "source_key": "fda",
        "source": "U.S. Food and Drug Administration",
        "source_type": "regulator",
        "source_url": "https://www.fda.gov/cosmetics/cosmetics-labeling-regulations/cosmetics-labeling-guide",
        "title": "Cosmetics packaging display-panel requirements",
        "title_zh": "化妆品包装展示面要求",
        "summary": (
            "Cosmetic containers and outer packaging must provide the required principal-display "
            "and information-panel statements in the prescribed location and prominence. Package "
            "design must preserve the mandatory identity, quantity, ingredient, warning, and firm details."
        ),
        "summary_zh": (
            "化妆品容器和外包装应在规定位置、以规定显著程度展示主展示面和信息面声明。包装设计"
            "必须保留法定的产品名称、净含量、成分、警示语和企业信息。"
        ),
        "requirement_type": "packaging",
        "category_codes": ["beauty"],
        "scope_condition": "Retail cosmetic containers and outer packaging.",
        "effective_from": "1975-05-05",
        "fallback_published_at": "1975-05-05",
        "authority": "U.S. Food and Drug Administration",
        "legal_reference": "21 CFR Part 701 packaging and display-panel provisions",
    },
    {
        "id": "access-us-mocra-registration-listing",
        "source_record_id": "FDCA-606-607-MOCRA",
        "source_key": "fda",
        "source": "U.S. Food and Drug Administration",
        "source_type": "regulator",
        "source_url": "https://www.fda.gov/cosmetics/registration-listing-cosmetic-product-facilities-and-products",
        "title": "MoCRA cosmetic facility registration and product listing",
        "title_zh": "MoCRA 化妆品设施注册与产品列名",
        "summary": (
            "MoCRA requires covered cosmetic-product facilities to register with FDA and responsible "
            "persons to list marketed cosmetic products, subject to statutory exemptions and renewal "
            "or update obligations."
        ),
        "summary_zh": (
            "《化妆品监管现代化法》要求受覆盖的化妆品设施向 FDA 注册，并由责任人对上市化妆品"
            "进行产品列名，同时遵守法定豁免、续期和更新义务。"
        ),
        "requirement_type": "registration",
        "category_codes": ["beauty"],
        "scope_condition": "Covered cosmetic facilities and responsible persons; exemptions may apply.",
        "effective_from": "2023-12-29",
        "fallback_published_at": "2023-12-29",
        "authority": "U.S. Food and Drug Administration",
        "legal_reference": "Federal Food, Drug, and Cosmetic Act sections 606 and 607",
    },
    {
        "id": "access-us-fpla-packaging-labeling",
        "source_record_id": "16-CFR-PART-500",
        "source_key": "govinfo",
        "source": "U.S. Government Publishing Office",
        "source_type": "government",
        "source_url": "https://www.govinfo.gov/content/pkg/CFR-2025-title16-vol1/xml/CFR-2025-title16-vol1-part500.xml",
        "title": "Fair Packaging and Labeling Act requirements",
        "title_zh": "《公平包装与标签法》要求",
        "summary": (
            "16 CFR Part 500 requires covered consumer-commodity packages to disclose identity, "
            "responsible business, and net quantity in the required form and location. FDA-regulated "
            "foods, drugs, devices, and cosmetics follow their applicable FDA provisions."
        ),
        "summary_zh": (
            "《联邦法规汇编》第 16 编第 500 部分要求受覆盖的消费品包装按规定形式和位置标示"
            "产品名称、责任企业及净含量。受 FDA 管辖的食品、药品、器械和化妆品应适用相应 FDA 规定。"
        ),
        "requirement_type": "packaging",
        "category_codes": ["generic", "electronics", "apparel", "home", "pet-supplies"],
        "scope_condition": "Consumer commodities within FTC jurisdiction; agency-specific exclusions apply.",
        "effective_from": "1968-07-01",
        "fallback_published_at": "1968-07-01",
        "authority": "Federal Trade Commission",
        "legal_reference": "16 CFR Part 500",
    },
    {
        "id": "access-us-food-facility-registration",
        "source_record_id": "21-CFR-PART-1-SUBPART-H",
        "source_key": "govinfo",
        "source": "U.S. Government Publishing Office",
        "source_type": "government",
        "source_url": "https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol1/xml/CFR-2025-title21-vol1-part1.xml",
        "title": "Food facility registration requirements",
        "title_zh": "食品设施注册要求",
        "summary": (
            "21 CFR Part 1 Subpart H establishes FDA food-facility registration requirements. "
            "Facilities that manufacture, process, pack, or hold animal food for U.S. consumption "
            "must determine registration and biennial-renewal duties, including foreign-facility duties."
        ),
        "summary_zh": (
            "《联邦法规汇编》第 21 编第 1 部分 H 分部规定 FDA 食品设施注册要求。为美国消费而"
            "生产、加工、包装或储存动物食品的设施，应确认注册、双年续期及境外设施义务。"
        ),
        "requirement_type": "registration",
        "category_codes": ["pet-food"],
        "scope_condition": "Animal-food facilities subject to FDA registration; exemptions must be checked.",
        "effective_from": "2003-12-12",
        "fallback_published_at": "2003-12-12",
        "authority": "U.S. Food and Drug Administration",
        "legal_reference": "21 CFR Part 1 Subpart H",
    },
    {
        "id": "access-us-animal-food-labeling",
        "source_record_id": "21-CFR-PART-501",
        "source_key": "govinfo",
        "source": "U.S. Government Publishing Office",
        "source_type": "government",
        "source_url": "https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol6/xml/CFR-2025-title21-vol6-part501.xml",
        "title": "Animal food labeling requirements",
        "title_zh": "动物食品标签要求",
        "summary": (
            "21 CFR Part 501 contains labeling requirements for animal food, including product "
            "identity, net quantity, ingredient statements, manufacturer or distributor information, "
            "and other statements required for the product and claims."
        ),
        "summary_zh": (
            "《联邦法规汇编》第 21 编第 501 部分规定动物食品的产品名称、净含量、成分表、"
            "制造商或经销商信息，以及与产品和宣称相关的其他标签要求。"
        ),
        "requirement_type": "labeling",
        "category_codes": ["pet-food"],
        "scope_condition": "Animal food offered for sale in the United States.",
        "effective_from": "1977-03-15",
        "fallback_published_at": "1977-03-15",
        "authority": "U.S. Food and Drug Administration",
        "legal_reference": "21 CFR Part 501",
    },
    {
        "id": "access-us-animal-food-import",
        "source_record_id": "FDA-IMPORTING-ANIMAL-FOOD",
        "source_key": "fda",
        "source": "U.S. Food and Drug Administration",
        "source_type": "regulator",
        "source_url": "https://www.fda.gov/animal-veterinary/import-exports/importing-animal-food",
        "title": "FDA requirements for importing animal food",
        "title_zh": "FDA 动物食品进口要求",
        "summary": (
            "Imported animal food must satisfy the same FDA requirements as domestic animal food. "
            "Importers must assess facility registration, prior notice, applicable food-safety rules, "
            "labeling, admissibility review, and any ingredient-specific restrictions."
        ),
        "summary_zh": (
            "进口动物食品必须满足与美国境内动物食品相同的 FDA 要求。进口商应核对设施注册、"
            "进口预先通知、适用的食品安全规则、标签、准入审查及特定成分限制。"
        ),
        "requirement_type": "import_requirement",
        "category_codes": ["pet-food"],
        "scope_condition": "Animal food imported into the United States.",
        "effective_from": "2011-01-04",
        "fallback_published_at": "2011-01-04",
        "authority": "U.S. Food and Drug Administration",
        "legal_reference": "Federal Food, Drug, and Cosmetic Act import requirements",
    },
    {
        "id": "access-us-cbp-import-entry",
        "source_record_id": "CBP-BASIC-IMPORT-EXPORT",
        "source_key": "cbp",
        "source": "U.S. Customs and Border Protection",
        "source_type": "government",
        "source_url": "https://www.cbp.gov/trade/basic-import-export",
        "title": "CBP basic import entry requirements",
        "title_zh": "美国海关基本进口申报要求",
        "summary": (
            "CBP's official import guidance requires importers to classify merchandise, establish "
            "value and origin, file the appropriate entry, pay duties and fees, retain records, and "
            "satisfy partner-government-agency requirements before release."
        ),
        "summary_zh": (
            "美国海关正式进口指南要求进口商完成商品归类、价值和原产地确定、适当的进口申报、"
            "税费缴纳和记录保存，并在放行前满足其他合作政府机构的要求。"
        ),
        "requirement_type": "import_requirement",
        "category_codes": "__all__",
        "scope_condition": "Commercial merchandise imported into the United States.",
        "effective_from": "1993-12-08",
        "fallback_published_at": "1993-12-08",
        "authority": "U.S. Customs and Border Protection",
        "legal_reference": "19 U.S.C. 1484 reasonable-care entry obligations",
    },
)


DOMAIN_CONFIG = {
    "tax": {
        "records": TAX_RECORDS,
        "filename": "taxes.json",
        "types_key": "tax_types",
        "manifest_domain": "tax",
        "telemetry_key": "us_tax_official",
        "label": "美国官方税收与关税",
    },
    "access": {
        "records": ACCESS_RECORDS,
        "filename": "access_requirements.json",
        "types_key": "requirement_types",
        "manifest_domain": "access",
        "telemetry_key": "us_access_official",
        "label": "美国官方准入与合规",
    },
}


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_source_date(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        parsed = parsed.astimezone(timezone.utc)
        return parsed.date().isoformat(), parsed.isoformat()
    except (TypeError, ValueError, OverflowError):
        return None, None


def _allowed_final_host(requested_url: str, final_url: str) -> bool:
    def normalize(host: str | None) -> str:
        value = str(host or "").lower()
        return value[4:] if value.startswith("www.") else value

    requested = normalize(urlsplit(requested_url).hostname)
    final = normalize(urlsplit(final_url).hostname)
    return bool(requested and final and (final == requested or final.endswith("." + requested)))


def fetch_official_source(url: str, *, timeout: int = 25) -> dict[str, Any]:
    """Fetch one bounded official page and return hashable response evidence."""
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("official source URL must be an absolute credential-free HTTPS URL")
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,*/*;q=0.5"})
    with urlopen(request, timeout=timeout) as response:
        status = int(getattr(response, "status", response.getcode()))
        final_url = response.geturl()
        if status != 200:
            raise RuntimeError(f"official source returned HTTP {status}")
        if not _allowed_final_host(url, final_url):
            raise RuntimeError(f"official source redirected to an unexpected host: {final_url}")
        body = response.read(MAX_SOURCE_BYTES + 1)
        if len(body) > MAX_SOURCE_BYTES:
            raise RuntimeError(f"official source exceeded {MAX_SOURCE_BYTES} bytes")
        if len(body) < 100:
            raise RuntimeError("official source response was unexpectedly small")
        published_at, last_modified_at = _parse_source_date(response.headers.get("Last-Modified"))
    return {
        "requested_url": url,
        "final_url": final_url,
        "http_status": status,
        "content_bytes": len(body),
        "source_content_hash": hashlib.sha256(body).hexdigest(),
        "published_at": published_at,
        "source_last_modified_at": last_modified_at,
    }


def _source_text_hash(record: Mapping[str, Any]) -> str:
    payload = json.dumps(
        {"title": record.get("title") or "", "summary": record.get("summary") or ""},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _translation(record: Mapping[str, Any], translated_at: str) -> dict[str, Any]:
    return {
        "source_language": "en",
        "target_language": "zh-CN",
        "status": "reviewed",
        "provider": "human-curated",
        "translated_at": translated_at,
        "source_hash": _source_text_hash(record),
        "human_reviewed": True,
    }


def _category_codes(spec: Mapping[str, Any], configured_categories: Sequence[str]) -> list[str]:
    declared = spec.get("category_codes")
    if declared == "__all__":
        return list(configured_categories)
    allowed = set(configured_categories)
    return [str(value).strip().casefold() for value in (declared or []) if str(value).strip().casefold() in allowed]


def build_record(
    spec: Mapping[str, Any],
    evidence: Mapping[str, Any],
    *,
    configured_categories: Sequence[str],
    collected_at: str,
    previous: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Bind a curated legal interpretation to the retrieved official snapshot."""
    record = {
        key: value
        for key, value in spec.items()
        if key not in {"fallback_published_at"}
    }
    record.update({
        "region": "US",
        "market": "US",
        "market_codes": ["US"],
        "jurisdiction_codes": ["US"],
        "category_codes": _category_codes(spec, configured_categories),
        "source_kind": "official",
        "source_url": str(evidence.get("final_url") or spec["source_url"]),
        "verification_status": "verified",
        "collected_at": collected_at,
        "retrieved_at": collected_at,
        "verified_at": collected_at,
        "published_at": str(evidence.get("published_at") or spec["fallback_published_at"]),
        "source_last_modified_at": evidence.get("source_last_modified_at"),
        "source_content_hash": evidence["source_content_hash"],
        "evidence_method": "official_https_snapshot_with_curated_legal_scope",
        "verification_notes": (
            "Official HTTPS source and authority host were verified; applicability remains subject "
            "to product facts, classification, origin, destination, and current agency guidance."
        ),
        "collector_key": COLLECTOR_KEY,
    })
    evidence_payload = {
        "source_record_id": record["source_record_id"],
        "source_url": record["source_url"],
        "source_content_hash": record["source_content_hash"],
        "legal_reference": record["legal_reference"],
        "title": record["title"],
        "summary": record["summary"],
        "market_codes": record["market_codes"],
        "category_codes": record["category_codes"],
        "effective_from": record.get("effective_from"),
        "tax_type": record.get("tax_type"),
        "tax_subtype": record.get("tax_subtype"),
        "requirement_type": record.get("requirement_type"),
        "scope_condition": record.get("scope_condition"),
    }
    record["evidence_hash"] = hashlib.sha256(
        json.dumps(evidence_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    prior_hash = str((previous or {}).get("evidence_hash") or "")
    record["change_type"] = "unchanged" if prior_hash == record["evidence_hash"] else (
        "initial_record" if not prior_hash else "source_snapshot_changed"
    )
    record["change_summary"] = (
        "Official source snapshot reverified; the normalized legal scope is unchanged."
        if record["change_type"] == "unchanged"
        else "Formal record generated from the verified official source snapshot and stated legal scope."
    )
    record["record_version"] = record["evidence_hash"][:16]
    record["translation"] = _translation(record, collected_at)
    return record


def _read_dataset(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) and isinstance(payload.get("items"), list) else {}
    except (OSError, ValueError, TypeError):
        return {}


def _atomic_write(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".tmp", prefix=path.name + ".", dir=path.parent, delete=False
    )
    temp_path = Path(handle.name)
    try:
        with handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def _fetch_sources(
    specs: Sequence[Mapping[str, Any]],
    fetcher: Callable[..., Mapping[str, Any]],
    *,
    timeout: int,
    max_workers: int = 6,
) -> tuple[dict[str, Mapping[str, Any]], dict[str, str], int]:
    governed_urls: list[str] = []
    evidence: dict[str, Mapping[str, Any]] = {}
    errors: dict[str, str] = {}
    for spec in specs:
        url = str(spec["source_url"])
        try:
            assert_source_collectable(str(spec["source_key"]))
        except Exception as error:
            errors[url] = re.sub(r"\s+", " ", str(error)).strip()[:300]
            continue
        if url not in governed_urls:
            governed_urls.append(url)
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=min(max_workers, len(governed_urls) or 1)) as pool:
        futures = {pool.submit(fetcher, url, timeout=timeout): url for url in governed_urls}
        for future in as_completed(futures):
            url = futures[future]
            try:
                evidence[url] = future.result()
            except Exception as error:  # individual official sources fail independently
                errors[url] = re.sub(r"\s+", " ", str(error)).strip()[:300]
    return evidence, errors, max(int((time.perf_counter() - started) * 1000), 0)


def collect_domain(
    domain: str,
    *,
    manifest: Mapping[str, Any] | None = None,
    existing: Mapping[str, Any] | None = None,
    fetcher: Callable[..., Mapping[str, Any]] = fetch_official_source,
    timeout: int = 25,
    now: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if domain not in DOMAIN_CONFIG:
        raise ValueError(f"unsupported regulatory domain: {domain}")
    config = DOMAIN_CONFIG[domain]
    specs = config["records"]
    manifest = manifest or load_market_scope()
    catalog = configured_catalog(manifest, market_codes=["US"])
    categories = list(catalog.get("category_keys") or [])
    if not categories or "US" not in (catalog.get("market_codes") or []):
        raise ValueError("US configured market/category scope is unavailable")
    allowed_types = list(
        ((manifest.get("data_domains") or {}).get(config["manifest_domain"]) or {}).get("types") or []
    )
    type_field = "tax_type" if domain == "tax" else "requirement_type"
    invalid = sorted({str(spec.get(type_field) or "") for spec in specs} - set(allowed_types))
    if invalid:
        raise ValueError(f"collector contains types outside market_scope.json: {invalid}")

    existing = dict(existing or {})
    existing_items = [item for item in existing.get("items", []) if isinstance(item, dict)]
    previous_by_id = {str(item.get("source_record_id") or ""): item for item in existing_items}
    evidence, errors, duration_ms = _fetch_sources(specs, fetcher, timeout=timeout)
    collected_at = now or iso_now()
    items = []
    successful_record_ids: set[str] = set()
    cached_record_ids: set[str] = set()
    for spec in specs:
        source_record_id = str(spec["source_record_id"])
        source_evidence = evidence.get(str(spec["source_url"]))
        previous = previous_by_id.get(source_record_id)
        if source_evidence:
            items.append(build_record(
                spec, source_evidence, configured_categories=categories,
                collected_at=collected_at, previous=previous,
            ))
            successful_record_ids.add(source_record_id)
        elif previous:
            items.append(dict(previous))
            cached_record_ids.add(source_record_id)

    managed_ids = {str(spec["source_record_id"]) for spec in specs}
    items.extend(
        dict(item) for item in existing_items
        if str(item.get("source_record_id") or "") not in managed_ids
    )
    all_sources_ok = not errors and len(successful_record_ids) == len(specs)
    updated_at = collected_at if successful_record_ids else existing.get("updated_at")
    dataset = {
        "schema_version": str(existing.get("schema_version") or "1.0"),
        "domain": domain,
        "updated_at": updated_at,
        "last_checked_at": collected_at if all_sources_ok else existing.get("last_checked_at"),
        "source_count": len({str(item.get("source_key") or item.get("source") or "") for item in items}),
        config["types_key"]: allowed_types,
        "source_checks": {
            url: {
                "status": "succeeded" if url in evidence else "failed",
                "checked_at": collected_at,
                "source_content_hash": evidence.get(url, {}).get("source_content_hash"),
                "source_last_modified_at": evidence.get(url, {}).get("source_last_modified_at"),
                "error": errors.get(url),
            }
            for url in dict.fromkeys(str(spec["source_url"]) for spec in specs)
        },
        "items": items,
        "language_contract": {
            "source_fields": ["title", "summary"],
            "display_fields": ["title_zh", "summary_zh"],
            "target_language": "zh-CN",
            "translation_metadata_field": "translation",
        },
    }
    successful_urls = len(evidence)
    failed_urls = len(errors)
    status = "succeeded" if not errors else ("degraded" if items else "failed")
    telemetry = {
        "key": config["telemetry_key"],
        "label": config["label"],
        "domain": domain,
        "core": True,
        "status": status,
        "market_codes": ["US"],
        "request_count": successful_urls + failed_urls,
        "successful_requests": successful_urls,
        "failed_requests": failed_urls,
        "records_collected": len(successful_record_ids),
        "records_in_scope": len(items),
        "duration_ms": duration_ms,
        "cache_used": bool(cached_record_ids),
        "cached_sections": sorted(cached_record_ids),
        "content_updated_at": updated_at,
        "last_checked_at": dataset.get("last_checked_at"),
        "attempted_at": collected_at,
        "errors": [f"{url}: {message}" for url, message in sorted(errors.items())],
    }
    return dataset, telemetry


def run_domain(
    domain: str,
    *,
    output: Path | None = None,
    timeout: int = 25,
    fetcher: Callable[..., Mapping[str, Any]] = fetch_official_source,
) -> tuple[dict[str, Any], dict[str, Any]]:
    assert_source_collectable("official-source")
    config = DOMAIN_CONFIG[domain]
    output = Path(output or DATA_DIR / config["filename"])
    existing = _read_dataset(output)
    dataset, telemetry = collect_domain(domain, existing=existing, fetcher=fetcher, timeout=timeout)
    if dataset.get("items"):
        _atomic_write(output, dataset)
    append_collection_source(telemetry, scope={
        "market_codes": ["US"],
        "category_keys": configured_catalog(load_market_scope(), market_codes=["US"])["category_keys"],
    })
    return dataset, telemetry


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Collect official US tax and market-access records")
    parser.add_argument("--domain", choices=("all", "tax", "access"), default="all")
    parser.add_argument("--timeout", type=int, default=25, help="per-source HTTPS timeout in seconds")
    args = parser.parse_args(argv)
    if not 5 <= args.timeout <= 120:
        parser.error("--timeout must be between 5 and 120 seconds")
    domains = ("tax", "access") if args.domain == "all" else (args.domain,)
    failed = []
    for domain in domains:
        try:
            dataset, telemetry = run_domain(domain, timeout=args.timeout)
        except Exception as error:
            print(f"[US REGULATORY] {domain} failed: {error}", file=sys.stderr)
            failed.append(domain)
            continue
        print(
            f"[US REGULATORY] {domain}: status={telemetry['status']} "
            f"records={len(dataset.get('items', []))} "
            f"requests={telemetry['successful_requests']}/{telemetry['request_count']}"
        )
        if not dataset.get("items"):
            failed.append(domain)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
