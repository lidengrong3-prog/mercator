#!/usr/bin/env python3
"""Validate publishable market data and emit a machine-readable quality report."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable
from urllib.parse import urlparse


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
DEFAULT_REPORT = os.path.join(DATA_DIR, "quality_report.json")
UTC = timezone.utc


DATASET_LABELS = {
    "policies": "政策动态",
    "rules": "平台规则",
    "alerts": "风险预警",
    "countries": "国家市场",
    "platforms": "平台档案",
    "us_market": "美国品类情报",
    "macro": "美国宏观指标",
    "cpsc": "CPSC 产品召回",
}


@dataclass
class DatasetResult:
    key: str
    path: str
    records: int = 0
    updated_at: str | None = None
    freshness_hours: float | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    @property
    def status(self) -> str:
        if self.errors:
            if all("超过新鲜度阈值" in error for error in self.errors):
                return "stale"
            return "failed"
        if any("超过新鲜度阈值" in warning for warning in self.warnings):
            return "stale"
        if self.warnings:
            return "degraded"
        return "healthy"

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": DATASET_LABELS[self.key],
            "status": self.status,
            "path": self.path.replace("\\", "/"),
            "records": self.records,
            "updated_at": self.updated_at,
            "freshness_hours": self.freshness_hours,
            "errors": self.errors,
            "warnings": self.warnings,
            "metrics": self.metrics,
        }


def load_json(path: str, result: DatasetResult) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        result.errors.append("文件不存在")
    except json.JSONDecodeError as exc:
        result.errors.append(f"JSON 解析失败：第 {exc.lineno} 行第 {exc.colno} 列")
    except OSError as exc:
        result.errors.append(f"文件读取失败：{exc}")
    return None


def parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        try:
            parsed = datetime.strptime(text, "%Y-%m-%d")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def valid_http_url(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def normalized_title(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().casefold())


def duplicate_count(values: Iterable[Any]) -> int:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        key = normalized_title(value)
        if not key:
            continue
        if key in seen:
            duplicates.add(key)
        seen.add(key)
    return len(duplicates)


def set_freshness(
    result: DatasetResult,
    value: Any,
    now: datetime,
    max_age_hours: int,
    *,
    required: bool = True,
) -> None:
    parsed = parse_datetime(value)
    if not parsed:
        if required:
            result.errors.append("缺少有效的更新时间")
        return
    result.updated_at = parsed.isoformat()
    age = (now - parsed).total_seconds() / 3600
    result.freshness_hours = round(age, 1)
    if age < -24:
        result.errors.append("更新时间异常：位于未来 24 小时之后")
    elif age > max_age_hours:
        result.errors.append(f"超过新鲜度阈值：{age:.1f} 小时 > {max_age_hours} 小时")


def validate_items_dataset(
    key: str,
    path: str,
    now: datetime,
    *,
    minimum: int,
    max_age_hours: int,
) -> DatasetResult:
    result = DatasetResult(key, os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        result.errors.append("根结构必须是包含 items 数组的对象")
        return result

    items = data["items"]
    result.records = len(items)
    set_freshness(result, data.get("updated_at"), now, max_age_hours)
    if len(items) < minimum:
        result.errors.append(f"记录数不足：{len(items)} < {minimum}")

    malformed = sum(not isinstance(item, dict) for item in items)
    rows = [item for item in items if isinstance(item, dict)]
    missing_ids = sum(not str(item.get("id", "")).strip() for item in rows)
    missing_titles = sum(not str(item.get("title", "")).strip() for item in rows)
    duplicate_ids = duplicate_count(item.get("id") for item in rows)
    duplicate_titles = duplicate_count(item.get("title") for item in rows)
    missing_sources = sum(
        not str(item.get("source") or item.get("platform") or "").strip()
        for item in rows
    )
    missing_urls = sum(
        not valid_http_url(item.get("source_url") or item.get("url"))
        for item in rows
    )
    future_dates = 0
    for item in rows:
        # A future effective date is legitimate; collection/publication dates are not.
        for field_name in ("collected_at", "published_at"):
            parsed = parse_datetime(item.get(field_name))
            if parsed and parsed > now + timedelta(days=1):
                future_dates += 1
                break

    result.metrics.update({
        "malformed_records": malformed,
        "missing_ids": missing_ids,
        "missing_titles": missing_titles,
        "duplicate_ids": duplicate_ids,
        "duplicate_titles": duplicate_titles,
        "missing_sources": missing_sources,
        "missing_or_invalid_urls": missing_urls,
        "future_dated_records": future_dates,
        "source_url_coverage_pct": round((len(rows) - missing_urls) * 100 / len(rows), 1) if rows else 0,
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条非对象记录")
    if missing_ids:
        result.errors.append(f"存在 {missing_ids} 条空 ID")
    if missing_titles:
        result.errors.append(f"存在 {missing_titles} 条空标题")
    if duplicate_ids:
        result.errors.append(f"存在 {duplicate_ids} 组重复 ID")
    if duplicate_titles:
        result.warnings.append(f"存在 {duplicate_titles} 组重复标题")
    if missing_sources:
        result.errors.append(f"存在 {missing_sources} 条无来源名称记录")
    if missing_urls:
        result.warnings.append(f"存在 {missing_urls} 条缺少有效来源 URL 的记录")
    if future_dates:
        result.errors.append(f"存在 {future_dates} 条异常未来日期记录")
    return result


def validate_alerts(now: datetime) -> DatasetResult:
    path = os.path.join(DATA_DIR, "alerts.json")
    result = DatasetResult("alerts", os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, list):
        result.errors.append("根结构必须是数组")
        return result
    result.records = len(data)
    if len(data) < 10:
        result.errors.append(f"记录数不足：{len(data)} < 10")
    malformed = sum(not isinstance(row, list) or len(row) < 8 for row in data)
    valid_rows = [row for row in data if isinstance(row, list) and len(row) >= 8]
    missing_ids = sum(not str(row[0]).strip() for row in valid_rows)
    missing_titles = sum(not str(row[3]).strip() for row in valid_rows)
    duplicate_ids = duplicate_count(row[0] for row in valid_rows)
    future_dates = sum(
        bool((parsed := parse_datetime(row[7])) and parsed > now + timedelta(days=1))
        for row in valid_rows
    )
    detail_path = os.path.join(DATA_DIR, "alerts_detailed.json")
    detail_result = DatasetResult("alerts", os.path.relpath(detail_path, ROOT))
    detail = load_json(detail_path, detail_result)
    generated_at = detail.get("meta", {}).get("generated_at") if isinstance(detail, dict) else None
    set_freshness(result, generated_at, now, 36)
    result.metrics.update({
        "malformed_records": malformed,
        "missing_ids": missing_ids,
        "missing_titles": missing_titles,
        "duplicate_ids": duplicate_ids,
        "future_dated_records": future_dates,
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条字段不足的预警")
    if missing_ids:
        result.errors.append(f"存在 {missing_ids} 条空 ID")
    if missing_titles:
        result.errors.append(f"存在 {missing_titles} 条空标题")
    if duplicate_ids:
        result.errors.append(f"存在 {duplicate_ids} 组重复 ID")
    if future_dates:
        result.errors.append(f"存在 {future_dates} 条异常未来日期记录")
    return result


def validate_countries(now: datetime) -> DatasetResult:
    path = os.path.join(DATA_DIR, "countries.json")
    result = DatasetResult("countries", os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, dict):
        result.errors.append("根结构必须是对象")
        return result
    rows = {key: value for key, value in data.items() if not key.startswith("_")}
    result.records = len(rows)
    if len(rows) < 35:
        result.errors.append(f"国家档案数不足：{len(rows)} < 35")
    malformed = sum(not isinstance(value, dict) for value in rows.values())
    missing_names = sum(
        isinstance(value, dict) and not str(value.get("name", "")).strip()
        for value in rows.values()
    )
    duplicate_names = duplicate_count(
        value.get("name") for value in rows.values() if isinstance(value, dict)
    )
    set_freshness(result, data.get("_metadata", {}).get("last_updated"), now, 24 * 7)
    result.metrics.update({
        "malformed_records": malformed,
        "missing_names": missing_names,
        "duplicate_names": duplicate_names,
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 个损坏的国家档案")
    if missing_names:
        result.errors.append(f"存在 {missing_names} 个空国家名称")
    if duplicate_names:
        result.errors.append(f"存在 {duplicate_names} 组重复国家名称")
    return result


def validate_platforms() -> DatasetResult:
    path = os.path.join(DATA_DIR, "platforms.json")
    result = DatasetResult("platforms", os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    if not isinstance(data, list):
        result.errors.append("根结构必须是数组")
        return result
    result.records = len(data)
    if len(data) < 20:
        result.errors.append(f"平台档案数不足：{len(data)} < 20")
    malformed = sum(not isinstance(row, dict) for row in data)
    rows = [row for row in data if isinstance(row, dict)]
    missing_names = sum(not str(row.get("name", "")).strip() for row in rows)
    duplicate_names = duplicate_count(row.get("name") for row in rows)
    result.metrics.update({
        "malformed_records": malformed,
        "missing_names": missing_names,
        "duplicate_names": duplicate_names,
        "catalog_type": "reference",
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条非对象平台记录")
    if missing_names:
        result.errors.append(f"存在 {missing_names} 条空平台名称")
    if duplicate_names:
        result.errors.append(f"存在 {duplicate_names} 组重复平台名称")
    return result


def validate_us_market(now: datetime) -> DatasetResult:
    index_path = os.path.join(DATA_DIR, "us_market", "index.json")
    result = DatasetResult("us_market", os.path.relpath(index_path, ROOT))
    data = load_json(index_path, result)
    if data is None:
        return result
    categories = data.get("categories") if isinstance(data, dict) else None
    if not isinstance(categories, list):
        result.errors.append("索引必须包含 categories 数组")
        return result
    result.records = len(categories)
    set_freshness(result, data.get("generated_at"), now, 36)
    if len(categories) < 8:
        result.errors.append(f"品类数不足：{len(categories)} < 8")
    duplicate_keys = duplicate_count(row.get("key") for row in categories if isinstance(row, dict))
    missing_files = 0
    invalid_sections = 0
    for row in categories:
        if not isinstance(row, dict):
            invalid_sections += 1
            continue
        filename = row.get("file")
        category_path = os.path.join(DATA_DIR, "us_market", str(filename or ""))
        category_result = DatasetResult("us_market", os.path.relpath(category_path, ROOT))
        category = load_json(category_path, category_result)
        if category is None:
            missing_files += 1
            continue
        required = ("country", "platforms", "rules", "policies", "alerts")
        if not isinstance(category, dict) or any(key not in category for key in required):
            invalid_sections += 1
    result.metrics.update({
        "duplicate_category_keys": duplicate_keys,
        "missing_category_files": missing_files,
        "invalid_category_files": invalid_sections,
    })
    if duplicate_keys:
        result.errors.append(f"存在 {duplicate_keys} 组重复品类 key")
    if missing_files:
        result.errors.append(f"缺少 {missing_files} 个品类文件")
    if invalid_sections:
        result.errors.append(f"存在 {invalid_sections} 个板块不完整的品类文件")
    return result


def validate_macro(now: datetime) -> DatasetResult:
    path = os.path.join(DATA_DIR, "us_market", "macro_indicators.json")
    result = DatasetResult("macro", os.path.relpath(path, ROOT))
    data = load_json(path, result)
    if data is None:
        return result
    indicators = data.get("indicators") if isinstance(data, dict) else None
    if not isinstance(indicators, dict):
        result.errors.append("根结构必须包含 indicators 对象")
        return result
    result.records = len(indicators)
    set_freshness(result, data.get("meta", {}).get("generated_at"), now, 72)
    if len(indicators) < 10:
        result.errors.append(f"宏观指标数不足：{len(indicators)} < 10")
    missing_sources = sum(not str(row.get("source", "")).strip() for row in indicators.values() if isinstance(row, dict))
    invalid_urls = sum(not valid_http_url(row.get("source_url")) for row in indicators.values() if isinstance(row, dict))
    malformed = sum(not isinstance(row, dict) for row in indicators.values())
    result.metrics.update({
        "malformed_records": malformed,
        "missing_sources": missing_sources,
        "missing_or_invalid_urls": invalid_urls,
        "collector_fetched": data.get("meta", {}).get("fetched"),
        "collector_failed": data.get("meta", {}).get("failed"),
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条损坏的宏观指标")
    if missing_sources:
        result.errors.append(f"存在 {missing_sources} 条无来源名称指标")
    if invalid_urls:
        result.errors.append(f"存在 {invalid_urls} 条无有效来源 URL 指标")
    return result


def validate_cpsc(now: datetime) -> DatasetResult:
    path = os.path.join(DATA_DIR, "us_market", "cpsc_recalls.json")
    result = DatasetResult("cpsc", os.path.relpath(path, ROOT))
    if not os.path.exists(path):
        result.warnings.append("本轮无 CPSC 缓存，召回预警将以其他来源降级运行")
        return result
    data = load_json(path, result)
    if data is None:
        return result
    recalls = data.get("recalls") if isinstance(data, dict) else None
    if not isinstance(recalls, list):
        result.errors.append("根结构必须包含 recalls 数组")
        return result
    result.records = len(recalls)
    set_freshness(result, data.get("meta", {}).get("generated_at"), now, 36)
    if len(recalls) < 1:
        result.errors.append("CPSC 召回缓存为空")
    rows = [row for row in recalls if isinstance(row, dict)]
    malformed = len(recalls) - len(rows)
    duplicate_ids = duplicate_count(row.get("id") for row in rows)
    missing_titles = sum(
        not str(row.get("title", "")).strip() for row in rows
    )
    missing_sources = sum(not str(row.get("source", "")).strip() for row in rows)
    invalid_urls = sum(not valid_http_url(row.get("url")) for row in rows)
    future_dates = sum(
        bool((parsed := parse_datetime(row.get("date"))) and parsed > now + timedelta(days=1))
        for row in rows
    )
    china_related = data.get("china_related", [])
    if not isinstance(china_related, list):
        result.errors.append("china_related 必须是数组")
        china_related = []
    result.metrics.update({
        "malformed_records": malformed,
        "duplicate_ids": duplicate_ids,
        "missing_titles": missing_titles,
        "missing_sources": missing_sources,
        "missing_or_invalid_urls": invalid_urls,
        "future_dated_records": future_dates,
        "china_related_records": len(china_related),
    })
    if malformed:
        result.errors.append(f"存在 {malformed} 条损坏的召回记录")
    if duplicate_ids:
        result.errors.append(f"存在 {duplicate_ids} 组重复召回 ID")
    if missing_titles:
        result.errors.append(f"存在 {missing_titles} 条空召回标题")
    if missing_sources:
        result.errors.append(f"存在 {missing_sources} 条无来源名称召回")
    if invalid_urls:
        result.errors.append(f"存在 {invalid_urls} 条无有效官方链接召回")
    if future_dates:
        result.errors.append(f"存在 {future_dates} 条异常未来日期召回")
    if not china_related:
        result.warnings.append("本轮没有识别到中国制造相关召回")
    return result


def validate_all(now: datetime | None = None) -> dict[str, Any]:
    now = (now or datetime.now(UTC)).astimezone(UTC)
    results = [
        validate_items_dataset("policies", os.path.join(DATA_DIR, "policies.json"), now, minimum=50, max_age_hours=36),
        validate_items_dataset("rules", os.path.join(DATA_DIR, "rules.json"), now, minimum=30, max_age_hours=36),
        validate_alerts(now),
        validate_countries(now),
        validate_platforms(),
        validate_us_market(now),
        validate_macro(now),
        validate_cpsc(now),
    ]
    errors = sum(len(result.errors) for result in results)
    non_stale_errors = sum(
        sum("超过新鲜度阈值" not in error for error in result.errors)
        for result in results
    )
    warnings = sum(len(result.warnings) for result in results)
    statuses = [result.status for result in results]
    if non_stale_errors:
        status = "failed"
    elif "stale" in statuses:
        status = "stale"
    elif warnings:
        status = "degraded"
    else:
        status = "healthy"
    return {
        "schema_version": 1,
        "generated_at": now.isoformat(),
        "status": status,
        "publishable": errors == 0,
        "summary": {
            "datasets": len(results),
            "healthy": statuses.count("healthy"),
            "degraded": statuses.count("degraded"),
            "stale": statuses.count("stale"),
            "failed": statuses.count("failed"),
            "errors": errors,
            "warnings": warnings,
        },
        "datasets": {result.key: result.as_dict() for result in results},
    }


def write_report(report: dict[str, Any], path: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Mercator market data before publishing")
    parser.add_argument("--report", default=DEFAULT_REPORT, help="Quality report output path")
    args = parser.parse_args()
    report = validate_all()
    write_report(report, args.report)

    print(f"[QUALITY] status={report['status']} publishable={report['publishable']}")
    for dataset in report["datasets"].values():
        print(
            f"  {dataset['key']:<12} {dataset['status']:<9} "
            f"records={dataset['records']:<4} errors={len(dataset['errors'])} warnings={len(dataset['warnings'])}"
        )
        for message in dataset["errors"]:
            print(f"    ERROR: {message}")
        for message in dataset["warnings"]:
            print(f"    WARN: {message}")
    print(f"[QUALITY] report={os.path.relpath(args.report, ROOT)}")
    return 0 if report["publishable"] else 1


if __name__ == "__main__":
    sys.exit(main())
