#!/usr/bin/env bash
# Full logical PostgreSQL backup + restore on disposable CI service only.
set -euo pipefail
[[ "${CI_ACCEPTANCE_DISPOSABLE_DB:-}" == "YES" ]] || { echo "Disposable CI DB only" >&2; exit 1; }
docker_id="$(docker ps --format '{{.ID}} {{.Image}}' | awk '$2 ~ /^postgres:16-alpine$/ {print $1;exit}')"
[[ -n "$docker_id" ]] || { echo "CI PostgreSQL service container not found" >&2; exit 1; }
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
echo "PASS disposable PostgreSQL pg_dump/pg_restore: $migrations migrations, $tenants tenants, $published published flows, $catalog catalog items"
