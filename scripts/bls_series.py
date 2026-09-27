"""Canonical BLS series semantics shared by collection and publication gates."""

from __future__ import annotations

import hashlib
import json
from typing import Any


BLS_METADATA_PAGE_BASE = "https://data.bls.gov/timeseries"

BLS_SERIES = {
    "CUSR0000SA0": {
        "name": "美国城市平均 CPI-U：所有项目（季调）",
        "official_name": "All items in U.S. city average, all urban consumers, seasonally adjusted",
        "unit": "指数（1982-84=100）",
        "description": "美国城市平均水平、所有城市消费者、所有项目的消费者价格指数，经季节调整。",
        "survey": "cu",
        "seasonal": "S",
        "seasonal_adjustment": "季节调整",
        "frequency": "月度",
        "base_period": "1982-84=100",
    },
    "CUSR0000SA0L1E": {
        "name": "美国城市平均核心 CPI-U：剔除食品和能源（季调）",
        "official_name": "All items less food and energy in U.S. city average, all urban consumers, seasonally adjusted",
        "unit": "指数（1982-84=100）",
        "description": "美国城市平均水平、所有城市消费者、剔除食品和能源后的消费者价格指数，经季节调整。",
        "survey": "cu",
        "seasonal": "S",
        "seasonal_adjustment": "季节调整",
        "frequency": "月度",
        "base_period": "1982-84=100",
    },
    "CUSR0000SA0L5": {
        "name": "美国城市平均 CPI-U：剔除医疗保健（季调）",
        "official_name": "All items less medical care in U.S. city average, all urban consumers, seasonally adjusted",
        "unit": "指数（1982-84=100）",
        "description": "美国城市平均水平、所有城市消费者、剔除医疗保健后的消费者价格指数，经季节调整。",
        "survey": "cu",
        "seasonal": "S",
        "seasonal_adjustment": "季节调整",
        "frequency": "月度",
        "base_period": "1982-84=100",
    },
    "CES0000000001": {
        "name": "美国非农就业人数：全部雇员（季调）",
        "official_name": "All employees, thousands, total nonfarm, seasonally adjusted",
        "unit": "千人",
        "description": "美国非农部门全部雇员人数，经季节调整，数值单位为千人。",
        "survey": "ce",
        "seasonal": "S",
        "seasonal_adjustment": "季节调整",
        "frequency": "月度",
        "base_period": "",
    },
}

BLS_EVIDENCE_FIELDS = (
    "series_id", "official_name", "name", "value", "unit", "date",
    "description", "seasonal_adjustment", "frequency", "base_period",
    "source_url", "metadata_url", "metadata_verified_at", "source_record_id",
)


def bls_evidence_hash(record: dict[str, Any]) -> str:
    """Hash the observation and its verified semantics as one auditable record."""
    payload = {field: record.get(field) for field in BLS_EVIDENCE_FIELDS}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
