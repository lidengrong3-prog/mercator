#!/usr/bin/env python3
"""Create a content-free summary of browser diagnostics for CI artifacts."""

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def summarize(directory):
    root = Path(directory)
    files = [path for path in root.rglob("*") if path.is_file()] if root.exists() else []
    suffixes = Counter((path.suffix.casefold() or "no-extension") for path in files)
    return {
        "status": "failed",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "diagnostic_files_present": bool(files),
        "file_count": len(files),
        "total_bytes": sum(path.stat().st_size for path in files),
        "file_types": dict(sorted(suffixes.items())),
        "content_included": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="test-results")
    parser.add_argument("--output", default="browser-acceptance-diagnostics.json")
    args = parser.parse_args()
    payload = summarize(args.input)
    Path(args.output).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
