#!/usr/bin/env bash
# Full logical PostgreSQL backup + restore on disposable CI service only.
set -euo pipefail
[[ "${CI_ACCEPTANCE_DISPOSABLE_DB:-}" == "YES" ]] || { echo "Disposable CI DB only" >&2; exit 1; }
if [[ -n "${CI_POSTGRES_CONTAINER:-}" ]]; then
  docker_id="$CI_POSTGRES_CONTAINER"
else
  mapfile -t postgres_services < <(docker ps --format '{{.ID}} {{.Image}}' | awk '$2 ~ /^postgres:16-alpine$/ {print $1}')
  [[ "${#postgres_services[@]}" -eq 1 ]] || { echo 'Set CI_POSTGRES_CONTAINER when the disposable PostgreSQL service is ambiguous or missing' >&2; exit 1; }
  docker_id="${postgres_services[0]}"
fi
[[ "$(docker inspect --format '{{.Config.Image}}' "$docker_id" 2>/dev/null || true)" == 'postgres:16-alpine' ]] || { echo 'Selected disposable PostgreSQL service must use postgres:16-alpine' >&2; exit 1; }
archive="$(mktemp /tmp/elhafez-ci-restore-XXXXXXXX.dump)"
trap 'rm -f "$archive"' EXIT
docker exec "$docker_id" pg_dump --format=custom --no-owner -U postgres -d elhafez_ci > "$archive"
test -s "$archive"
docker exec "$docker_id" createdb -U postgres elhafez_ci_restored
docker exec -i "$docker_id" pg_restore --no-owner --no-acl -U postgres -d elhafez_ci_restored < "$archive"
db_query(){ docker exec "$docker_id" psql -U postgres -d elhafez_ci_restored -Atc "$1" | tr -d '\r'; }
migrations="$(db_query 'SELECT count(*) FROM schema_migrations')"
tenants="$(db_query 'SELECT count(*) FROM tenants')"
published="$(db_query 'SELECT count(*) FROM chatbot_flow_versions')"
catalog="$(db_query 'SELECT count(*) FROM chatbot_catalog_items')"
[[ "$migrations" =~ ^[0-9]+$ && "$migrations" -ge 25 ]] || { echo "Missing restored migrations" >&2; exit 1; }
[[ "$tenants" =~ ^[0-9]+$ && "$tenants" -ge 2 ]] || { echo "Missing restored companies" >&2; exit 1; }
[[ "$published" =~ ^[0-9]+$ && "$published" -ge 1 ]] || { echo "Missing restored published flows" >&2; exit 1; }
[[ "$catalog" =~ ^[0-9]+$ && "$catalog" -ge 1 ]] || { echo "Missing restored catalog items" >&2; exit 1; }
# Compare every public table, including bytea media, memberships, ciphertext and pending jobs.
# Counts alone cannot detect changed payloads or missing queue records.
fingerprint() {
  docker exec -i "$docker_id" psql -v ON_ERROR_STOP=1 -U postgres -d "$1" -At <<'SQL'
SELECT format('SELECT %L || '':'' || count(*) || '':'' || md5(coalesce(string_agg(row_to_json(t)::text, E''\\n'' ORDER BY row_to_json(t)::text),'''')) FROM %I.%I t;', tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\gexec
SQL
}
source_fingerprint="$(fingerprint elhafez_ci)"
restored_fingerprint="$(fingerprint elhafez_ci_restored)"
[[ -n "$source_fingerprint" && "$source_fingerprint" == "$restored_fingerprint" ]] || { echo "Restored table content mismatch" >&2; exit 1; }
echo 'PASS exact row-content fingerprints for every public table (including present media/queues/secrets)'
echo "PASS disposable PostgreSQL pg_dump/pg_restore: $migrations migrations, $tenants tenants, $published published flows, $catalog catalog items"

if [[ "${CI_LOCAL_CLOSURE:-}" == "1" ]]; then
  # Failed restore is confined to a NEW empty disposable database and one transaction.
  docker exec "$docker_id" createdb -U postgres elhafez_ci_failed_restore
  broken="$(mktemp /tmp/boat-broken-XXXXXX.dump)"
  head -c 4096 "$archive" > "$broken"
  if docker exec -i "$docker_id" pg_restore --single-transaction --exit-on-error --no-owner --no-acl -U postgres -d elhafez_ci_failed_restore < "$broken"; then
    rm -f "$broken"; echo 'Expected truncated restore failure' >&2; exit 1
  fi
  rm -f "$broken"
  [[ "$(fingerprint elhafez_ci_restored)" == "$restored_fingerprint" ]] || { echo 'Failed restore affected valid restored database' >&2; exit 1; }
  node tests/restore-seeded.mjs
  echo 'PASS failed isolated restore does not alter original or successful restored database'
fi
