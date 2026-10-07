#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Never point this runner at production. Bootstrap deletes schemas in *_test only.
if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  sql() { psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 "$@"; }
else
  container="${PL_TEST_CONTAINER:-para-legal-tests}"
  docker exec "$container" psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='para_legal_test'" | rg -q 1 || docker exec "$container" createdb -U postgres para_legal_test
  sql() { docker exec -i "$container" psql -U postgres -d para_legal_test -X -v ON_ERROR_STOP=1 "$@"; }
fi
sql < tests/database/bootstrap.sql
for migration in supabase/migrations/*.sql; do sql < "$migration"; done
sql <<'SQL'
insert into public.pl_profiles(id,display_name,role) values('00000000-0000-0000-0000-000000000001','TEST OWNER','owner');
SQL
sql < tests/database-permissions.sql
sql < tests/database/integrity.sql

sql < tests/database/mfa.sql

sql < tests/database/public-access.sql
