#!/usr/bin/env python3
"""Validate that a fresh Supabase database can start from migrations alone."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
FOUNDATION_MIGRATION = "20260824000000_database_foundation.sql"
LEGACY_BOOTSTRAP_FILES = (
    ROOT / "supabase" / "schema.sql",
    ROOT / "supabase" / "phase2_schema.sql",
    ROOT / "supabase" / "monitored_shops.sql",
)
REQUIRED_INDEX_COVERAGE = {
    "user_watchlist user/time": "ON public.user_watchlist (user_id, created_at DESC)",
    "user_watchlist user/type": "UNIQUE (user_id, item_type, item_id)",
    "user_activity user/time": "ON public.user_activity (user_id, created_at DESC)",
    "generated_reports user/time": "ON public.generated_reports (user_id, created_at DESC)",
    "query_history user/time": "ON public.query_history(user_id, created_at DESC)",
    "feedback status": "ON public.feedback(status)",
    "watchlist_items user/type": "ON public.watchlist_items(user_id, item_type)",
}

CREATE_TABLE_RE = re.compile(
    r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z][a-z0-9_]*)",
    re.IGNORECASE,
)
CREATE_FUNCTION_RE = re.compile(
    r"\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z][a-z0-9_]*)\s*\(",
    re.IGNORECASE,
)
CREATE_TRIGGER_RE = re.compile(
    r"\bCREATE\s+TRIGGER\s+([a-z][a-z0-9_]*)\s+",
    re.IGNORECASE,
)
TABLE_DEPENDENCY_RES = (
    re.compile(r"\bREFERENCES\s+public\.([a-z][a-z0-9_]*)", re.IGNORECASE),
    re.compile(r"\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.([a-z][a-z0-9_]*)", re.IGNORECASE),
    re.compile(r"\bCREATE\s+(?:UNIQUE\s+)?INDEX[\s\S]*?\bON\s+public\.([a-z][a-z0-9_]*)", re.IGNORECASE),
    re.compile(r"\bCREATE\s+POLICY[\s\S]*?\bON\s+public\.([a-z][a-z0-9_]*)", re.IGNORECASE),
    re.compile(r"\bCREATE\s+TRIGGER[\s\S]*?\bON\s+public\.([a-z][a-z0-9_]*)", re.IGNORECASE),
)


class MigrationChainError(RuntimeError):
    pass


def _objects(pattern: re.Pattern[str], source: str) -> set[str]:
    return {match.casefold() for match in pattern.findall(source)}


def _without_comments(source: str) -> str:
    return re.sub(r"--[^\n]*", "", source)


def validate_migration_chain(migrations_dir: Path = MIGRATIONS) -> dict[str, object]:
    migrations_dir = Path(migrations_dir)
    files = sorted(migrations_dir.glob("*.sql"))
    if not files:
        raise MigrationChainError("no migration files found")
    if files[0].name != FOUNDATION_MIGRATION:
        raise MigrationChainError(
            f"migration chain must start with {FOUNDATION_MIGRATION}, got {files[0].name}"
        )

    migration_source = "\n".join(path.read_text(encoding="utf-8") for path in files)
    migration_tables = _objects(CREATE_TABLE_RE, migration_source)
    migration_functions = _objects(CREATE_FUNCTION_RE, migration_source)
    migration_triggers = _objects(CREATE_TRIGGER_RE, migration_source)

    legacy_source = "\n".join(path.read_text(encoding="utf-8") for path in LEGACY_BOOTSTRAP_FILES)
    expected = {
        "tables": _objects(CREATE_TABLE_RE, legacy_source),
        "functions": _objects(CREATE_FUNCTION_RE, legacy_source),
        "triggers": _objects(CREATE_TRIGGER_RE, legacy_source),
    }
    actual = {
        "tables": migration_tables,
        "functions": migration_functions,
        "triggers": migration_triggers,
    }
    for kind in ("tables", "functions", "triggers"):
        missing = expected[kind] - actual[kind]
        if missing:
            raise MigrationChainError(
                f"legacy bootstrap {kind} missing from migrations: {', '.join(sorted(missing))}"
            )

    normalized_migrations = re.sub(r"\s+", " ", migration_source).casefold()
    missing_indexes = [
        label for label, fragment in REQUIRED_INDEX_COVERAGE.items()
        if re.sub(r"\s+", " ", fragment).casefold() not in normalized_migrations
    ]
    if missing_indexes:
        raise MigrationChainError(
            "legacy performance indexes lack equivalent migration coverage: "
            + ", ".join(missing_indexes)
        )

    available_tables: set[str] = set()
    for path in files:
        source = _without_comments(path.read_text(encoding="utf-8"))
        created_here = _objects(CREATE_TABLE_RE, source)
        visible = available_tables | created_here
        dependencies = set()
        for pattern in TABLE_DEPENDENCY_RES:
            dependencies.update(_objects(pattern, source))
        missing = dependencies - visible
        if missing:
            raise MigrationChainError(
                f"{path.name} references tables before creation: {', '.join(sorted(missing))}"
            )
        available_tables.update(created_here)

    required_foundation_tables = {
        "profiles", "query_history", "watchlist_items", "reports", "feedback",
        "market_data", "monitored_shops",
    }
    foundation_source = files[0].read_text(encoding="utf-8")
    missing_foundation = required_foundation_tables - _objects(CREATE_TABLE_RE, foundation_source)
    if missing_foundation:
        raise MigrationChainError(
            "foundation migration is incomplete: " + ", ".join(sorted(missing_foundation))
        )

    return {
        "migration_count": len(files),
        "migration_head": files[-1].stem,
        "tables": sorted(migration_tables),
        "legacy_tables_covered": sorted(expected["tables"]),
        "index_strategies_covered": len(REQUIRED_INDEX_COVERAGE),
    }


def main() -> int:
    try:
        report = validate_migration_chain()
    except MigrationChainError as error:
        print(f"[MIGRATION CHAIN] FAILED: {error}")
        return 1
    print(
        "[MIGRATION CHAIN] OK: "
        f"{report['migration_count']} migrations, {len(report['tables'])} public tables, "
        f"{report['index_strategies_covered']} index strategies, head {report['migration_head']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
