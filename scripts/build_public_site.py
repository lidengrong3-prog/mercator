#!/usr/bin/env python3
"""Assemble the GitHub Pages artifact from an explicit public allowlist."""

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from sync_to_supabase import public_market_data_payload


ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATASETS = {
    "market_scope": Path("market_scope.json"),
    "quality_report": Path("quality_report.json"),
    "countries": Path("countries.json"),
    "platforms": Path("platforms.json"),
    "policies": Path("policies.json"),
    "rules": Path("rules.json"),
    "alerts": Path("alerts.json"),
    "taxes": Path("taxes.json"),
    "access_requirements": Path("access_requirements.json"),
    "industry_advisories": Path("industry_advisories.json"),
    "macro": Path("us_market") / "macro_indicators.json",
}


def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def record_count(key, data):
    if key in {"policies", "rules", "taxes", "access_requirements", "industry_advisories"}:
        return len(data.get("items", [])) if isinstance(data, dict) else 0
    if key in {"platforms", "alerts"}:
        return len(data) if isinstance(data, list) else 0
    if key == "countries":
        return sum(not name.startswith("_") for name in data) if isinstance(data, dict) else 0
    if key == "macro":
        return len(data.get("indicators", {})) if isinstance(data, dict) else 0
    return None


def build_public_site(output, root=ROOT):
    root = Path(root).resolve()
    output = Path(output).resolve()
    if output == root:
        raise ValueError("Output directory cannot be the repository root")
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"Output directory must be empty: {output}")
    output.mkdir(parents=True, exist_ok=True)

    for filename in ("index.html", ".nojekyll", "_headers", "edgeone.json"):
        shutil.copy2(root / filename, output / filename)
    shutil.copytree(root / "assets", output / "assets")

    manifest_datasets = {}
    for key, relative_path in PUBLIC_DATASETS.items():
        source = load_json(root / "data" / relative_path)
        public = public_market_data_payload(key, source)
        write_json(output / "data" / relative_path, public)
        source_records = record_count(key, source)
        published_records = record_count(key, public)
        manifest_datasets[key] = {
            "path": (Path("data") / relative_path).as_posix(),
            "source_records": source_records,
            "published_records": published_records,
            "excluded_records": (
                source_records - published_records
                if source_records is not None and published_records is not None
                else None
            ),
        }

    manifest = {
        "schema_version": 1,
        "policy": "explicit-allowlist-formal-projection",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_files": sorted(
            details["path"] for details in manifest_datasets.values()
        ),
        "datasets": manifest_datasets,
    }
    write_json(output / "public-data-manifest.json", manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="_site", help="Empty output directory")
    args = parser.parse_args()
    manifest = build_public_site(args.output)
    print(
        "[PUBLIC SITE] Published "
        f"{len(manifest['data_files'])} allowlisted data files to {Path(args.output).resolve()}"
    )


if __name__ == "__main__":
    main()
