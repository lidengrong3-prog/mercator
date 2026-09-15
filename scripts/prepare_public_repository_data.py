#!/usr/bin/env python3
"""Replace mixed collector outputs with their allowed public projections."""

import argparse
import json
import shutil
from pathlib import Path

from build_public_site import PUBLIC_DATASETS
from sync_to_supabase import public_market_data_payload


ROOT = Path(__file__).resolve().parent.parent
PASSTHROUGH_DATASETS = {"market_scope", "quality_report"}


def _write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def prepare_public_repository_data(root=ROOT, archive_dir=None):
    root = Path(root).resolve()
    archive = Path(archive_dir).resolve() if archive_dir else root / "data" / "private_repository_source"
    changed = []
    for key, relative_path in PUBLIC_DATASETS.items():
        if key in PASSTHROUGH_DATASETS:
            continue
        path = root / "data" / relative_path
        source = json.loads(path.read_text(encoding="utf-8"))
        public = public_market_data_payload(key, source)
        if public == source:
            continue
        archived = archive / relative_path
        archived.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, archived)
        _write_json(path, public)
        changed.append((path, archived))
    return changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--archive-dir")
    args = parser.parse_args()
    changed = prepare_public_repository_data(args.root, args.archive_dir)
    print(f"[PUBLIC REPOSITORY] Projected {len(changed)} dataset(s)")
    for path, archived in changed:
        print(f"  {path.relative_to(Path(args.root).resolve())} (private source archived at {archived})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
