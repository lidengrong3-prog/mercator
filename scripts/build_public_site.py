#!/usr/bin/env python3
"""Assemble the GitHub Pages artifact from an explicit public allowlist."""

import argparse
import gzip
import hashlib
import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from sync_to_supabase import public_market_data_payload


ROOT = Path(__file__).resolve().parent.parent
ENVIRONMENTS = ("development", "test", "production")
PAGE_ASSETS = {
    "overview": ("assets/js/alerts-settings.js",),
    "products": ("assets/styles/workspaces.css", "assets/js/products-shops.js"),
    "shops": ("assets/styles/workspaces.css", "assets/js/products-shops.js"),
    "myfit": ("assets/styles/workspaces.css", "assets/js/products-shops.js"),
    "alerts": ("assets/js/alerts-settings.js",),
    "platforms": ("assets/js/alerts-settings.js",),
    "settings": ("assets/styles/workspaces.css", "assets/js/alerts-settings.js"),
    "data": ("assets/styles/workspaces.css", "assets/js/alerts-settings.js"),
    "admin": ("assets/styles/workspaces.css", "assets/js/alerts-settings.js"),
    "content": ("assets/js/resource-center.js",),
    "tools": ("assets/styles/workspaces.css", "assets/js/resource-center.js"),
    "report": ("assets/styles/workspaces.css",),
    "pricing": ("assets/styles/workspaces.css",),
}
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


def resolve_environment_value(value, environ):
    match = re.fullmatch(r"\$\{([A-Z][A-Z0-9_]*)\}", str(value or ""))
    return environ.get(match.group(1), "").strip() if match else str(value or "").strip()


def load_environment_config(root, environment, environ=None):
    if environment not in ENVIRONMENTS:
        raise ValueError(f"Unknown frontend environment: {environment}")
    config = load_json(root / "config" / "environments" / f"{environment}.json")
    if config.get("environment") != environment:
        raise ValueError(f"Frontend environment file does not identify {environment}")
    environ = os.environ if environ is None else environ
    supabase = config.get("supabase") or {}
    url = resolve_environment_value(supabase.get("url"), environ).rstrip("/")
    anon_key = resolve_environment_value(supabase.get("anonKey"), environ)
    required = bool(supabase.get("required"))
    if required and (not url or not anon_key):
        raise ValueError(
            f"{environment} frontend requires its Supabase URL and anonymous key"
        )
    if url:
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.path not in {"", "/"}:
            raise ValueError("Frontend Supabase URL must be an HTTPS origin")
    if anon_key and not re.fullmatch(r"[A-Za-z0-9._-]+", anon_key):
        raise ValueError("Frontend Supabase anonymous key contains invalid characters")
    legal = load_json(root / "config" / "legal-versions.json")
    legal_versions = {
        "privacyPolicy": str(legal.get("privacyPolicy") or "").strip(),
        "termsOfService": str(legal.get("termsOfService") or "").strip(),
    }
    if not all(re.fullmatch(r"[A-Za-z0-9._-]{1,80}", value) for value in legal_versions.values()):
        raise ValueError("Legal document versions must be non-empty stable identifiers")
    return {
        "environment": environment,
        "supabase": {"url": url, "anonKey": anon_key},
        "legal": legal_versions,
        "breakpoints": {"phoneMax": 640, "tabletMax": 1024},
    }


def content_security_policy(supabase_url="", *, response_header=False):
    connect_sources = ["'self'"]
    if supabase_url:
        parsed = urlparse(supabase_url)
        connect_sources.extend(
            [f"https://{parsed.netloc}", f"wss://{parsed.netloc}"]
        )
    directives = [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'self' https://cdn.jsdelivr.net",
        "style-src-attr 'none'",
        "script-src 'self' https://cdn.jsdelivr.net",
        "script-src-attr 'none'",
        "connect-src " + " ".join(connect_sources),
        "frame-src 'none'",
    ]
    if response_header:
        directives.append("frame-ancestors 'none'")
    directives.extend(
        [
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
        ]
    )
    return "; ".join(directives)


def hashed_asset_path(relative_path, payload):
    path = Path(relative_path)
    digest = hashlib.sha256(payload).hexdigest()[:12]
    return path.with_name(f"{path.stem}.{digest}{path.suffix}").as_posix()


def asset_measurement(path):
    payload = path.read_bytes()
    return {"bytes": len(payload), "gzip_bytes": len(gzip.compress(payload, mtime=0))}


def sum_measurements(measurements, logical_paths):
    selected = [measurements[path] for path in logical_paths]
    return {
        "bytes": sum(item["bytes"] for item in selected),
        "gzip_bytes": sum(item["gzip_bytes"] for item in selected),
    }


def enforce_performance_budgets(root, output, asset_manifest, initial_js, initial_css):
    budgets = load_json(root / "config" / "performance-budgets.json")
    measurements = {
        logical: asset_measurement(output / hashed)
        for logical, hashed in asset_manifest.items()
        if Path(logical).suffix in {".js", ".css"}
    }
    all_js = sorted(path for path in measurements if path.endswith(".js"))
    all_css = sorted(path for path in measurements if path.endswith(".css"))
    measured = {
        "initial": {
            "javascript": sum_measurements(measurements, initial_js),
            "css": sum_measurements(measurements, initial_css),
        },
        "pages": {},
        "total": {
            "javascript": sum_measurements(measurements, all_js),
            "css": sum_measurements(measurements, all_css),
        },
    }
    for page, paths in PAGE_ASSETS.items():
        page_js = [path for path in paths if path.endswith(".js")]
        page_css = [path for path in paths if path.endswith(".css")]
        measured["pages"][page] = {
            "javascript": sum_measurements(measurements, page_js),
            "css": sum_measurements(measurements, page_css),
        }

    checks = [
        ("initial javascript", measured["initial"]["javascript"], budgets["initial"], "javascript"),
        ("initial css", measured["initial"]["css"], budgets["initial"], "css"),
        ("total javascript", measured["total"]["javascript"], budgets["total"], "javascript"),
        ("total css", measured["total"]["css"], budgets["total"], "css"),
    ]
    for page, details in measured["pages"].items():
        checks.append((f"page {page} javascript", details["javascript"], budgets["page"], "javascript"))
        checks.append((f"page {page} css", details["css"], budgets["page"], "css"))
    failures = []
    for label, actual, budget, kind in checks:
        for suffix in ("bytes", "gzip_bytes"):
            limit = budget[f"{kind}_{suffix}"]
            if actual[suffix] > limit:
                failures.append(f"{label} {suffix} {actual[suffix]} exceeds {limit}")
    report = {
        "schema_version": 1,
        "budgets": budgets,
        "measured": measured,
        "status": "failed" if failures else "passed",
        "failures": failures,
    }
    write_json(output / "performance-budget-report.json", report)
    if failures:
        raise ValueError("Frontend performance budget failed: " + "; ".join(failures))
    return report


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


def build_public_site(output, root=ROOT, environment="development", environ=None):
    root = Path(root).resolve()
    output = Path(output).resolve()
    if output == root:
        raise ValueError("Output directory cannot be the repository root")
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"Output directory must be empty: {output}")
    output.mkdir(parents=True, exist_ok=True)
    runtime_config = load_environment_config(root, environment, environ=environ)

    for filename in (".nojekyll", "CNAME"):
        shutil.copy2(root / filename, output / filename)
    shutil.copytree(root / ".well-known", output / ".well-known")
    shutil.copy2(root / "deploy" / "edgeone-middleware.js", output / "middleware.js")

    asset_manifest = {}
    for source in sorted((root / "assets").rglob("*")):
        if not source.is_file():
            continue
        logical = source.relative_to(root).as_posix()
        if logical == "assets/runtime-config.js":
            continue
        payload = source.read_bytes()
        hashed = hashed_asset_path(logical, payload)
        target = output / hashed
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        asset_manifest[logical] = hashed

    runtime_config["assets"] = dict(sorted(asset_manifest.items()))
    runtime_source = (
        "window.JAY_APP_CONFIG = Object.freeze("
        + json.dumps(runtime_config, ensure_ascii=False, separators=(",", ":"))
        + ");\n"
    ).encode("utf-8")
    runtime_logical = "assets/runtime-config.js"
    runtime_hashed = hashed_asset_path(runtime_logical, runtime_source)
    (output / runtime_hashed).write_bytes(runtime_source)
    asset_manifest[runtime_logical] = runtime_hashed
    write_json(output / "asset-manifest.json", dict(sorted(asset_manifest.items())))

    source_html = (root / "index.html").read_text(encoding="utf-8")
    local_script_sources = re.findall(r'<script[^>]+src="(assets/[^"]+\.js)"', source_html)
    local_style_sources = re.findall(r'<link[^>]+href="(assets/[^"]+\.css)"', source_html)
    html = source_html
    for logical, hashed in sorted(asset_manifest.items(), key=lambda item: -len(item[0])):
        html = html.replace(f'"{logical}"', f'"{hashed}"')
    html_csp = content_security_policy(runtime_config["supabase"]["url"])
    html = re.sub(
        r'(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(">)',
        lambda match: match.group(1) + html_csp + match.group(2),
        html,
        count=1,
    )
    (output / "index.html").write_text(html, encoding="utf-8")

    header_csp = content_security_policy(
        runtime_config["supabase"]["url"], response_header=True
    )
    headers = (root / "_headers").read_text(encoding="utf-8")
    headers = re.sub(
        r"(?m)^(\s*Content-Security-Policy:)\s*.*$",
        lambda match: f"{match.group(1)} {header_csp}",
        headers,
        count=1,
    )
    (output / "_headers").write_text(headers, encoding="utf-8")
    edgeone = load_json(root / "edgeone.json")
    for header in edgeone["headers"][0]["headers"]:
        if header.get("key") == "Content-Security-Policy":
            header["value"] = header_csp
    write_json(output / "edgeone.json", edgeone)

    performance = enforce_performance_budgets(
        root,
        output,
        asset_manifest,
        local_script_sources,
        local_style_sources,
    )

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
        "frontend_environment": environment,
        "asset_manifest": "asset-manifest.json",
        "performance_budget": {
            "path": "performance-budget-report.json",
            "status": performance["status"],
        },
    }
    write_json(output / "public-data-manifest.json", manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="_site", help="Empty output directory")
    parser.add_argument(
        "--environment",
        choices=ENVIRONMENTS,
        default="development",
        help="Frontend environment configuration to render",
    )
    args = parser.parse_args()
    manifest = build_public_site(args.output, environment=args.environment)
    print(
        "[PUBLIC SITE] Published "
        f"{len(manifest['data_files'])} allowlisted data files for "
        f"{manifest['frontend_environment']} to {Path(args.output).resolve()}"
    )


if __name__ == "__main__":
    main()
