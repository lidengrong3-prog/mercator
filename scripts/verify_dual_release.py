#!/usr/bin/env python3
"""Verify EdgeOne and the GitHub Pages origin serve one R11 release artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse


DEFAULT_GITHUB_PAGES_IPS = (
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
)


class DualReleaseError(RuntimeError):
    pass


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def parse_headers(raw: str) -> dict[str, str]:
    blocks = [block for block in raw.replace("\r\n", "\n").split("\n\n") if block.strip()]
    for block in reversed(blocks):
        lines = block.splitlines()
        if not lines or not lines[0].startswith("HTTP/"):
            continue
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                name, value = line.split(":", 1)
                headers[name.strip().lower()] = value.strip()
        return headers
    return {}


def curl_fetch(url: str, *, resolve_ip: str | None = None) -> tuple[int, bytes, dict[str, str]]:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise DualReleaseError("release probe URL must use HTTPS")
    with tempfile.TemporaryDirectory() as temp_dir:
        body_path = Path(temp_dir) / "body"
        header_path = Path(temp_dir) / "headers"
        command = [
            "curl", "--silent", "--show-error", "--location", "--max-time", "30",
            "--header", "Cache-Control: no-cache", "--header", "Pragma: no-cache",
            "--dump-header", str(header_path), "--output", str(body_path),
            "--write-out", "%{http_code}",
        ]
        if resolve_ip:
            command.extend(["--resolve", f"{parsed.hostname}:443:{resolve_ip}"])
        command.append(url)
        completed = subprocess.run(command, check=False, capture_output=True, text=True)
        if completed.returncode != 0:
            raise DualReleaseError(
                f"release probe transport failed for {parsed.hostname}: curl {completed.returncode}"
            )
        try:
            status = int(completed.stdout[-3:])
        except ValueError as error:
            raise DualReleaseError("release probe did not return an HTTP status") from error
        body = body_path.read_bytes() if body_path.exists() else b""
        headers = parse_headers(header_path.read_text(encoding="utf-8", errors="replace"))
        return status, body, headers


def fetch_with_origin_retry(url: str, origin_ips: tuple[str, ...]):
    failures = []
    for address in origin_ips:
        try:
            return curl_fetch(url, resolve_ip=address)
        except DualReleaseError as error:
            failures.append(str(error))
    raise DualReleaseError("all GitHub Pages origin addresses failed: " + "; ".join(failures))


def checked_json(payload: bytes, description: str) -> dict:
    try:
        value = json.loads(payload)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DualReleaseError(f"{description} is not valid JSON") from error
    if not isinstance(value, dict):
        raise DualReleaseError(f"{description} must be a JSON object")
    return value


def validate_expected(expected: dict) -> None:
    if expected.get("schema_version") != 1:
        raise DualReleaseError("unsupported release integrity schema")
    if not expected.get("release_sha") or not expected.get("migration_head"):
        raise DualReleaseError("release integrity identity is incomplete")
    rules = expected.get("edgeone_rules") or {}
    if (rules.get("authority") != "repository-build-artifact"
            or rules.get("manual_overrides_allowed") is not False):
        raise DualReleaseError("release integrity does not forbid manual EdgeOne overrides")
    resources = expected.get("resources") or {}
    if not isinstance(resources, dict) or not resources:
        raise DualReleaseError("release integrity has no resources")
    for path, record in resources.items():
        if (not path or path.startswith("/") or ".." in Path(path).parts
                or not isinstance(record, dict)
                or len(str(record.get("sha256") or "")) != 64
                or int(record.get("bytes") or 0) < 1):
            raise DualReleaseError(f"invalid release resource contract: {path}")


def probe_surface(
    name: str,
    base_url: str,
    expected: dict,
    expected_integrity_sha: str,
    *,
    resolve_ip: str | None = None,
    origin_ips: tuple[str, ...] = (),
) -> dict:
    cache_key = expected["release_sha"]

    def fetch(path: str):
        url = urljoin(base_url.rstrip("/") + "/", path) + f"?r11={cache_key}"
        if origin_ips:
            return fetch_with_origin_retry(url, origin_ips)
        return curl_fetch(url, resolve_ip=resolve_ip)

    status, integrity_raw, _ = fetch("release-integrity.json")
    if status != 200:
        raise DualReleaseError(f"{name} release-integrity.json returned HTTP {status}")
    if digest(integrity_raw) != expected_integrity_sha:
        remote = checked_json(integrity_raw, f"{name} release integrity")
        raise DualReleaseError(
            f"{name} release integrity mismatch: expected {expected['release_sha']} "
            f"got {remote.get('release_sha') or 'unknown'}"
        )
    remote_integrity = checked_json(integrity_raw, f"{name} release integrity")
    if remote_integrity != expected:
        raise DualReleaseError(f"{name} release integrity content differs from the build artifact")

    observed = {}
    root_headers = {}
    for path, record in expected["resources"].items():
        status, payload, headers = fetch(path)
        if status != 200:
            raise DualReleaseError(f"{name} resource {path} returned HTTP {status}")
        actual_digest = digest(payload)
        if actual_digest != record["sha256"] or len(payload) != record["bytes"]:
            raise DualReleaseError(f"{name} resource fingerprint differs: {path}")
        observed[path] = actual_digest
        if path == "index.html":
            root_headers = headers

    release_raw = fetch("release.json")[1]
    release = checked_json(release_raw, f"{name} release manifest")
    for field in ("release_sha", "migration_head", "production_origin", "asset_manifest_sha256"):
        expected_value = (
            expected.get(field)
            if field != "asset_manifest_sha256"
            else expected["resources"]["asset-manifest.json"]["sha256"]
        )
        if release.get(field) != expected_value:
            raise DualReleaseError(f"{name} release manifest has the wrong {field}")

    if name == "edgeone":
        rules = expected["edgeone_rules"]
        header_name = str(rules["source_header"]).lower()
        if root_headers.get(header_name) != rules["source_header_value"]:
            raise DualReleaseError("EdgeOne did not apply the repository-owned response rules")
        private_status, _, private_headers = fetch("data/_r11_private_probe.json")
        if private_status != 404 or "no-store" not in private_headers.get("cache-control", "").lower():
            raise DualReleaseError("EdgeOne repository middleware is not enforcing private data denial")

    return {
        "status": "passed",
        "release_sha": release["release_sha"],
        "migration_head": release["migration_head"],
        "index_sha256": observed["index.html"],
        "asset_manifest_sha256": observed["asset-manifest.json"],
        "critical_resource_count": len(observed),
        "direct_origin": bool(origin_ips or resolve_ip),
    }


def verify_once(
    expected: dict,
    expected_integrity_sha: str,
    edgeone_url: str,
    github_pages_url: str,
    github_pages_ips: tuple[str, ...],
) -> dict:
    edgeone = probe_surface("edgeone", edgeone_url, expected, expected_integrity_sha)
    github_pages = probe_surface(
        "github_pages", github_pages_url, expected, expected_integrity_sha,
        origin_ips=github_pages_ips,
    )
    for field in ("release_sha", "migration_head", "index_sha256", "asset_manifest_sha256"):
        if edgeone[field] != github_pages[field]:
            raise DualReleaseError(f"EdgeOne and GitHub Pages differ for {field}")
    return {
        "status": "passed",
        "release_sha": expected["release_sha"],
        "migration_head": expected["migration_head"],
        "evidence_source": "live_http",
        "mock_used": False,
        "fallback_used": False,
        "differences": [],
        "surfaces": {"edgeone": edgeone, "github_pages": github_pages},
        "edgeone_rules": expected["edgeone_rules"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected", required=True)
    parser.add_argument("--edgeone-url", required=True)
    parser.add_argument("--github-pages-url", required=True)
    parser.add_argument("--github-pages-origin-ips", default=",".join(DEFAULT_GITHUB_PAGES_IPS))
    parser.add_argument("--wait-seconds", type=int, default=600)
    parser.add_argument("--poll-seconds", type=int, default=10)
    parser.add_argument("--output", default="dual-release-result.json")
    args = parser.parse_args()

    expected_path = Path(args.expected)
    expected_raw = expected_path.read_bytes()
    expected = checked_json(expected_raw, "expected release integrity")
    validate_expected(expected)
    origin_ips = tuple(value.strip() for value in args.github_pages_origin_ips.split(",") if value.strip())
    if not origin_ips:
        raise DualReleaseError("at least one GitHub Pages origin IP is required")

    deadline = time.monotonic() + max(0, args.wait_seconds)
    last_error = None
    while True:
        try:
            result = verify_once(
                expected,
                digest(expected_raw),
                args.edgeone_url,
                args.github_pages_url,
                origin_ips,
            )
            Path(args.output).write_text(
                json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(json.dumps(result, ensure_ascii=False))
            return 0
        except DualReleaseError as error:
            last_error = error
            if time.monotonic() >= deadline:
                raise DualReleaseError(f"dual release did not converge: {last_error}") from error
            time.sleep(max(1, args.poll_seconds))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (DualReleaseError, OSError) as error:
        raise SystemExit(f"[R11 DUAL RELEASE] FAILED: {error}")
