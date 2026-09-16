#!/usr/bin/env bash
set -Eeuo pipefail

database_url_variable="${1:-SUPABASE_DB_URL}"
database_url="${!database_url_variable:-}"

if [[ -z "$database_url" ]]; then
  echo "Missing database URL environment variable: $database_url_variable" >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install --yes ca-certificates curl postgresql-client

server_version_num="$(psql "$database_url" -X -Atqc 'SHOW server_version_num')"
if [[ ! "$server_version_num" =~ ^[0-9]{6}$ ]]; then
  echo "PostgreSQL returned an invalid server_version_num" >&2
  exit 1
fi
server_major="$((10#$server_version_num / 10000))"

client_version="$(pg_dump --version)"
if [[ ! "$client_version" =~ ([0-9]+)\. ]]; then
  echo "Cannot determine the installed pg_dump major version" >&2
  exit 1
fi
client_major="${BASH_REMATCH[1]}"

if [[ "$client_major" == "$server_major" ]]; then
  echo "PostgreSQL client major $client_major matches the server"
  exit 0
fi

. /etc/os-release
if [[ -z "${VERSION_CODENAME:-}" ]]; then
  echo "Cannot determine the runner distribution codename" >&2
  exit 1
fi

sudo install -d /usr/share/postgresql-common/pgdg
sudo curl --fail --silent --show-error \
  --output /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null

sudo apt-get update
sudo apt-get install --yes "postgresql-client-${server_major}"

client_bin="/usr/lib/postgresql/${server_major}/bin"
if [[ ! -x "$client_bin/pg_dump" || ! -x "$client_bin/pg_restore" ]]; then
  echo "Matching PostgreSQL client binaries were not installed" >&2
  exit 1
fi

echo "$client_bin" >> "$GITHUB_PATH"
"$client_bin/pg_dump" --version
"$client_bin/pg_restore" --version
