#!/usr/bin/env python3
"""Reject restricted data, high-confidence secrets and untraceable public data."""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA_FILES = {
    "data/access_requirements.json",
    "data/alerts.json",
    "data/countries.json",
    "data/industry_advisories.json",
    "data/market_scope.json",
    "data/platforms.json",
    "data/policies.json",
    "data/provenance_schema.json",
    "data/quality_report.json",
    "data/rules.json",
    "data/taxes.json",
    "data/us_market/macro_indicators.json",
}
PUBLIC_FACT_DATASETS = {
    "data/access_requirements.json": "items",
    "data/policies.json": "items",
    "data/rules.json": "items",
    "data/taxes.json": "items",
    "data/alerts.json": "alerts",
    "data/us_market/macro_indicators.json": "indicators",
}
RESTRICTED_EXACT = {
    "data/_cfd_part1.json", "data/_ext_part1.json", "data/_new_cfd_js.txt",
    "data/_new_ext_js.txt", "data/alerts_detailed.json", "data/collection_run.json",
    "data/countries_new.json", "data/macro_raw.json", "data/policies_baseline.json",
    "data/rules_baseline.json", "data/quarantine_future_records.json",
    "data/quarantine_unverified_baseline.json", "data/us_market/cpsc_recalls.json",
    "data/us_market/index.json",
}
US_MARKET_PRIVATE = {
    "apparel.json", "auto.json", "beauty.json", "electronics.json", "home.json",
    "sports.json", "supplements.json", "toys.json",
}
RESTRICTED_COMPONENTS = {
    "_sync_logs", "private_repository_source", "raw", "raw_data", "raw_responses",
    "paid_data", "licensed_data", "quarantine", "tikhub",
}
SECRET_PATTERNS = (
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("AWS access key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("Stripe live key", re.compile(r"\bsk_live_[A-Za-z0-9]{16,}\b")),
    ("Resend API key", re.compile(r"\bre_[A-Za-z0-9]{24,}\b")),
    ("provider API key", re.compile(r"\bsk-[A-Za-z0-9_-]{24,}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
)
TEXT_SUFFIXES = {
    ".cjs", ".css", ".env", ".example", ".html", ".ini", ".js", ".json",
    ".jsonl", ".md", ".mjs", ".py", ".sql", ".toml", ".ts", ".txt", ".yaml", ".yml",
}


def tracked_files(root=ROOT):
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=root, check=True, capture_output=True,
    )
    return [item.decode("utf-8", errors="surrogateescape") for item in result.stdout.split(b"\0") if item]


def restricted_path_reason(relative):
    path = PurePosixPath(relative)
    lowered = relative.casefold()
    parts = {part.casefold() for part in path.parts}
    if lowered in RESTRICTED_EXACT:
        return "restricted data path"
    if parts & RESTRICTED_COMPONENTS:
        return "restricted directory"
    if len(path.parts) == 3 and path.parts[:2] == ("data", "us_market") and path.name in US_MARKET_PRIVATE:
        return "private US category dataset"
    if path.parts and path.parts[0].casefold() == "reports" and path.suffix.casefold() == ".pdf":
        return "legacy generated PDF"
    if path.parts and path.parts[0] == "data" and lowered not in PUBLIC_DATA_FILES:
        if path.suffix.casefold() in {".json", ".jsonl", ".ndjson", ".csv", ".tsv"}:
            return "data file is not on the public repository allowlist"
    return None


def secret_findings(root, files):
    findings = []
    for relative in files:
        path = root / relative
        if not path.is_file() or path.suffix.casefold() not in TEXT_SUFFIXES:
            continue
        if path.stat().st_size > 5 * 1024 * 1024:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in SECRET_PATTERNS:
            for match in pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                findings.append(f"{relative}:{line}: possible {label}")
    return findings


def large_raw_findings(root, files):
    findings = []
    for relative in files:
        path = root / relative
        if not path.is_file():
            continue
        suffix = path.suffix.casefold()
        lower = relative.casefold()
        if suffix in {".jsonl", ".ndjson"} and path.stat().st_size > 512 * 1024:
            findings.append(f"{relative}: large line-delimited data ({path.stat().st_size} bytes)")
        elif suffix == ".json" and path.stat().st_size > 1024 * 1024 and any(
            marker in lower for marker in ("raw", "response", "snapshot", "export", "dump")
        ):
            findings.append(f"{relative}: large raw-like JSON ({path.stat().st_size} bytes)")
    return findings


def _fact_records(relative, payload):
    kind = PUBLIC_FACT_DATASETS.get(relative)
    if kind == "items":
        return payload.get("items", []) if isinstance(payload, dict) else []
    if kind == "alerts":
        records = []
        for row in payload if isinstance(payload, list) else []:
            if isinstance(row, dict):
                records.append(row)
            elif isinstance(row, list) and len(row) > 9 and isinstance(row[9], dict):
                records.append(row[9])
        return records
    if kind == "indicators":
        values = payload.get("indicators", {}).values() if isinstance(payload, dict) else []
        return [value for value in values if isinstance(value, dict)]
    return []


def provenance_findings(root):
    findings = []
    for relative in PUBLIC_FACT_DATASETS:
        path = root / relative
        if not path.exists():
            findings.append(f"{relative}: missing public dataset")
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            findings.append(f"{relative}: invalid JSON ({error})")
            continue
        for index, record in enumerate(_fact_records(relative, payload)):
            missing = [field for field in ("source_record_id", "evidence_hash") if not record.get(field)]
            if missing:
                findings.append(f"{relative} record {index}: missing {', '.join(missing)}")
            source_url = str(record.get("source_url") or "").casefold()
            source_name = str(record.get("source") or "").casefold()
            if "tikhub" in source_url or "tikhub" in source_name:
                findings.append(f"{relative} record {index}: licensed TikHub data is public")
    return findings


def run_checks(root=ROOT, files=None):
    root = Path(root).resolve()
    files = tracked_files(root) if files is None else list(files)
    findings = []
    for relative in files:
        reason = restricted_path_reason(relative)
        if reason:
            findings.append(f"{relative}: {reason}")
    findings.extend(secret_findings(root, files))
    findings.extend(large_raw_findings(root, files))
    findings.extend(provenance_findings(root))
    return sorted(set(findings))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    findings = run_checks(Path(args.root))
    if findings:
        print("[REPOSITORY PRIVACY] FAILED", file=sys.stderr)
        for finding in findings:
            print(f"  - {finding}", file=sys.stderr)
        return 1
    print("[REPOSITORY PRIVACY] Passed: tracked files, secrets and public provenance are clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
