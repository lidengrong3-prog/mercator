#!/usr/bin/env python3
"""Create auditable Simplified Chinese display fields for regulatory data.

The source title and summary are never overwritten. Translation metadata is
bound to a hash of the source text so stale translations cannot be published
after a collector updates the original record.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATASETS = ("policies.json", "taxes.json", "access_requirements.json")
ZH_RE = re.compile(r"[\u3400-\u9fff]")
URL_ONLY_RE = re.compile(r"^https?://\S+$", re.IGNORECASE)
TITLE_GLOSSARY_ZH = {
    # Argos 1.9 tokenizes this chemical name incorrectly ("ryl"). Keep the
    # established Chinese chemical name explicit and reviewable.
    "Acrylonitrile": "丙烯腈",
}


def contains_chinese(value: object) -> bool:
    return bool(ZH_RE.search(str(value or "")))


def source_hash(item: dict) -> str:
    payload = json.dumps(
        {"title": item.get("title") or "", "summary": item.get("summary") or ""},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def translation_is_current(item: dict) -> bool:
    meta = item.get("translation") if isinstance(item.get("translation"), dict) else {}
    title = str(item.get("title") or "").strip()
    summary = str(item.get("summary") or "").strip()
    title_zh = str(item.get("title_zh") or "").strip()
    summary_zh = str(item.get("summary_zh") or "").strip()
    return (
        contains_chinese(title_zh)
        and (not summary or contains_chinese(summary_zh))
        and (not contains_chinese(title) or title_zh == title)
        and (not URL_ONLY_RE.fullmatch(summary) or summary_zh == f"原文链接：{summary}")
        and meta.get("source_hash") == source_hash(item)
        and meta.get("status") in {"source_zh", "translated", "reviewed"}
    )


def api_config() -> tuple[str, str, str]:
    key = (
        os.getenv("REGULATORY_TRANSLATION_API_KEY")
        or os.getenv("AI_API_KEY")
        or os.getenv("DEEPSEEK_API_KEY")
        or ""
    ).strip()
    url = (
        os.getenv("REGULATORY_TRANSLATION_API_URL")
        or os.getenv("AI_API_URL")
        or os.getenv("DEEPSEEK_API_URL")
        or "https://api.deepseek.com/chat/completions"
    ).strip().rstrip("/")
    if url.endswith("api.deepseek.com"):
        url += "/chat/completions"
    model = (
        os.getenv("REGULATORY_TRANSLATION_MODEL")
        or os.getenv("AI_MODEL")
        or os.getenv("DEEPSEEK_MODEL")
        or "deepseek-chat"
    ).strip()
    return key, url, model


def parse_json_object(value: str) -> dict:
    raw = str(value or "").strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.I)
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("translation response did not contain a JSON object")
    result = json.loads(raw[start : end + 1])
    if not isinstance(result, dict):
        raise ValueError("translation response was not an object")
    return result


def translate_with_api(item: dict, key: str, url: str, model: str) -> tuple[str, str]:
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是法规翻译员。忠实翻译为简体中文，不增删事实、数字、机构名称和法律编号。"
                        "只输出 JSON：{\"title_zh\":\"...\",\"summary_zh\":\"...\"}。"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "title": str(item.get("title") or ""),
                            "summary": str(item.get("summary") or "")[:6000],
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "temperature": 0,
            "max_tokens": 1800,
            "response_format": {"type": "json_object"},
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "JAY-Guanhai-Regulatory-Translator/1.0",
        },
    )
    with urlopen(request, timeout=60) as response:
        body = json.loads(response.read().decode("utf-8"))
    translated = parse_json_object(body["choices"][0]["message"]["content"])
    title_zh = str(translated.get("title_zh") or "").strip()
    summary_zh = str(translated.get("summary_zh") or "").strip()
    if not contains_chinese(title_zh):
        raise ValueError("translated title is not Simplified Chinese")
    if item.get("summary") and not contains_chinese(summary_zh):
        raise ValueError("translated summary is not Simplified Chinese")
    return title_zh, summary_zh


def translate_with_argos(item: dict) -> tuple[str, str]:
    """Offline backfill provider; production automation uses the API path."""
    try:
        from argostranslate.translate import translate
    except ImportError as error:
        raise RuntimeError("Argos Translate is not installed") from error
    title = str(item.get("title") or "").strip()
    summary = str(item.get("summary") or "").strip()
    title_zh = TITLE_GLOSSARY_ZH.get(title) or translate(title, "en", "zh").strip()
    summary_zh = translate(summary, "en", "zh").strip() if summary else ""
    if not contains_chinese(title_zh):
        raise ValueError("Argos translated title is not Chinese")
    if summary and not contains_chinese(summary_zh):
        raise ValueError("Argos translated summary is not Chinese")
    return title_zh, summary_zh


def mark_source_chinese(item: dict, now: str) -> None:
    item["title_zh"] = str(item.get("title") or "").strip()
    item["summary_zh"] = str(item.get("summary") or "").strip()
    item["translation"] = {
        "source_language": "zh-CN",
        "target_language": "zh-CN",
        "status": "source_zh",
        "provider": "source",
        "translated_at": now,
        "source_hash": source_hash(item),
        "human_reviewed": True,
    }


def translate_file(
    path: Path, *, require_config: bool, limit: int | None, provider: str
) -> tuple[int, int, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        raise ValueError(f"{path.name} must contain an items array")
    key, url, model = api_config()
    now = datetime.now(timezone.utc).isoformat()
    changed = translated_count = pending_count = 0
    for item in items:
        if not isinstance(item, dict) or translation_is_current(item):
            continue
        title = str(item.get("title") or "").strip()
        summary = str(item.get("summary") or "").strip()
        if contains_chinese(title) and (not summary or contains_chinese(summary)):
            mark_source_chinese(item, now)
            changed += 1
            continue
        if contains_chinese(title) and URL_ONLY_RE.fullmatch(summary):
            item["title_zh"] = title
            item["summary_zh"] = f"原文链接：{summary}"
            item["translation"] = {
                "source_language": "mixed",
                "target_language": "zh-CN",
                "status": "translated",
                "provider": "source-normalization",
                "translated_at": now,
                "source_hash": source_hash(item),
                "human_reviewed": False,
            }
            changed += 1
            continue
        if limit is not None and translated_count >= limit:
            pending_count += 1
            continue
        if provider == "api" and not key:
            pending_count += 1
            continue
        if provider == "argos":
            title_zh, summary_zh = translate_with_argos(item)
            provider_name, provider_model = "argos-offline", "translate-en_zh-1.9"
        else:
            title_zh, summary_zh = translate_with_api(item, key, url, model)
            provider_name, provider_model = "openai-compatible", model
        if contains_chinese(title):
            title_zh = title
        if contains_chinese(summary):
            summary_zh = summary
        item["title_zh"] = title_zh
        item["summary_zh"] = summary_zh
        item["translation"] = {
            "source_language": "auto",
            "target_language": "zh-CN",
            "status": "translated",
            "provider": provider_name,
            "model": provider_model,
            "translated_at": now,
            "source_hash": source_hash(item),
            "human_reviewed": False,
        }
        changed += 1
        translated_count += 1
    data["language_contract"] = {
        "source_fields": ["title", "summary"],
        "display_fields": ["title_zh", "summary_zh"],
        "target_language": "zh-CN",
        "translation_metadata_field": "translation",
    }
    if changed or "language_contract" not in json.loads(path.read_text(encoding="utf-8")):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if require_config and pending_count and provider == "api" and not key:
        raise RuntimeError("regulatory translation API is not configured")
    return changed, translated_count, pending_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Translate regulatory display fields to Simplified Chinese")
    parser.add_argument("--require-config", action="store_true", help="fail when untranslated records exist and no API is configured")
    parser.add_argument("--limit", type=int, default=None, help="maximum API-translated records per run")
    parser.add_argument("--provider", choices=("api", "argos"), default="api", help="translation provider")
    parser.add_argument("--check", action="store_true", help="do not translate; fail when any display translation is missing or stale")
    args = parser.parse_args()
    total_pending = 0
    for filename in DATASETS:
        path = DATA_DIR / filename
        if not path.exists():
            print(f"[translation] missing dataset: {filename}", file=sys.stderr)
            return 1
        if args.check:
            data = json.loads(path.read_text(encoding="utf-8"))
            pending = sum(
                1 for item in data.get("items", [])
                if isinstance(item, dict) and not translation_is_current(item)
            )
            print(f"[translation] {filename}: pending={pending}")
            total_pending += pending
            continue
        changed, translated, pending = translate_file(
            path, require_config=args.require_config, limit=args.limit, provider=args.provider
        )
        print(f"[translation] {filename}: changed={changed}, api_translated={translated}, pending={pending}")
        total_pending += pending
    return 1 if args.check and total_pending else 0


if __name__ == "__main__":
    raise SystemExit(main())
