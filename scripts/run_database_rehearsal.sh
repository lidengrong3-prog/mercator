#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.39.2}"
EXPECTED_MIGRATION_COUNT="${EXPECTED_MIGRATION_COUNT:-51}"
REPORT_PATH="${DATABASE_REHEARSAL_REPORT:-database-rehearsal-result.json}"
DB_URL="${LOCAL_REHEARSAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
MIGRATION_DIR="$ROOT_DIR/supabase/migrations"

mapfile -t migrations < <(find "$MIGRATION_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
migration_count="${#migrations[@]}"
if [[ "$migration_count" -ne "$EXPECTED_MIGRATION_COUNT" ]]; then
  echo "Expected $EXPECTED_MIGRATION_COUNT migrations, found $migration_count" >&2
  exit 1
fi

head_version="${migrations[$((migration_count - 1))]%%_*}"
previous_version="${migrations[$((migration_count - 2))]%%_*}"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
started_epoch="$(date +%s)"

supabase() {
  npx --yes "supabase@${SUPABASE_CLI_VERSION}" "$@"
}

psql_rehearsal() {
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 "$@"
}

scalar() {
  psql_rehearsal -Atq -c "$1" | tr -d '[:space:]'
}

rate_limit_path_has_extensions() {
  scalar "SELECT EXISTS (
    SELECT 1
      FROM pg_proc AS procedure
      JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      CROSS JOIN LATERAL unnest(COALESCE(procedure.proconfig, ARRAY[]::text[])) AS setting
     WHERE namespace.nspname = 'public'
       AND procedure.proname = 'consume_security_rate_limit'
       AND setting LIKE 'search_path=%extensions%'
  )::text"
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "$label: expected '$expected', got '$actual'" >&2
    exit 1
  fi
}

cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting isolated Supabase stack"
supabase start -x studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor

echo "Rebuilding an empty database through all $migration_count migrations"
fresh_started_epoch="$(date +%s)"
supabase db reset --local --no-seed
assert_equal "$migration_count" "$(scalar 'SELECT count(*) FROM supabase_migrations.schema_migrations')" "fresh migration ledger"
assert_equal "$head_version" "$(scalar 'SELECT max(version) FROM supabase_migrations.schema_migrations')" "fresh migration head"
psql_rehearsal -f scripts/database_rehearsal_assertions.sql
fresh_seconds="$(( $(date +%s) - fresh_started_epoch ))"

echo "Rebuilding to migration $previous_version and rehearsing the upgrade to $head_version"
upgrade_started_epoch="$(date +%s)"
supabase db reset --local --no-seed --version "$previous_version"
assert_equal "$((migration_count - 1))" "$(scalar 'SELECT count(*) FROM supabase_migrations.schema_migrations')" "pre-upgrade migration ledger"
assert_equal "$previous_version" "$(scalar 'SELECT max(version) FROM supabase_migrations.schema_migrations')" "pre-upgrade migration head"
assert_equal "false" "$(rate_limit_path_has_extensions)" "pre-upgrade rate-limit extension path"
psql_rehearsal -f scripts/database_upgrade_seed.sql

supabase migration up --local
assert_equal "$migration_count" "$(scalar 'SELECT count(*) FROM supabase_migrations.schema_migrations')" "upgraded migration ledger"
assert_equal "$head_version" "$(scalar 'SELECT max(version) FROM supabase_migrations.schema_migrations')" "upgraded migration head"
assert_equal "true" "$(rate_limit_path_has_extensions)" "upgraded rate-limit extension path"
assert_equal "preserve-me" "$(scalar "SELECT data->>'value' FROM public.market_data WHERE key = 'migration-rehearsal-existing-row'")" "existing market data preservation"
assert_equal "migration-rehearsal-existing-row" "$(scalar "SELECT approval_reference FROM public.production_rollout_state WHERE singleton = TRUE")" "existing rollout state preservation"
psql_rehearsal -f scripts/database_rehearsal_assertions.sql
psql_rehearsal -Atq -c "SELECT public.heartbeat_collection_worker('migration-rehearsal', 'ready', 'github-actions', '${GITHUB_SHA:-local}', NULL, '{\"isolated\":true}'::jsonb);" >/dev/null
assert_equal "ready" "$(scalar "SELECT status FROM public.collection_worker_instances WHERE worker_id = 'migration-rehearsal'")" "Worker heartbeat write"

echo "Verifying that a second migration pass has nothing left to apply"
supabase migration up --local
assert_equal "$migration_count" "$(scalar 'SELECT count(*) FROM supabase_migrations.schema_migrations')" "idempotent migration ledger"
upgrade_seconds="$(( $(date +%s) - upgrade_started_epoch ))"
completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
total_seconds="$(( $(date +%s) - started_epoch ))"

python - "$REPORT_PATH" "$started_at" "$completed_at" "$migration_count" "$previous_version" "$head_version" "$fresh_seconds" "$upgrade_seconds" "$total_seconds" <<'PY'
import json
import pathlib
import sys

(
    report_path,
    started_at,
    completed_at,
    migration_count,
    previous_version,
    head_version,
    fresh_seconds,
    upgrade_seconds,
    total_seconds,
) = sys.argv[1:]
report = {
    "status": "passed",
    "database": "ephemeral-local-supabase",
    "contains_production_data": False,
    "started_at": started_at,
    "completed_at": completed_at,
    "migration_count": int(migration_count),
    "previous_version": previous_version,
    "head_version": head_version,
    "checks": {
        "empty_database_rebuild": "passed",
        "existing_database_upgrade": "passed",
        "existing_rows_preserved": "passed",
        "schema_security_contract": "passed",
        "second_pass_no_pending_migrations": "passed",
    },
    "durations_seconds": {
        "empty_database_rebuild": int(fresh_seconds),
        "existing_database_upgrade": int(upgrade_seconds),
        "total": int(total_seconds),
    },
}
path = pathlib.Path(report_path)
path.write_text(json.dumps(report, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=True))
PY
