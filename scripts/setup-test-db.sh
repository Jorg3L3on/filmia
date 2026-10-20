#!/usr/bin/env bash
# Creates (or refreshes) the LOCAL database the DB-backed tests use, with the current schema.
# Usage: npm run test:db:setup   (TEST_DATABASE_URL defaults to postgresql://localhost:5432/filmia_test)
set -euo pipefail
url="${TEST_DATABASE_URL:-postgresql://localhost:5432/filmia_test}"
host="$(node -e 'console.log(new URL(process.argv[1]).hostname)' "$url")"
case "$host" in localhost|127.0.0.1|::1|\[::1\]) ;; *) echo "TEST_DATABASE_URL must be local (got $host)" >&2; exit 1 ;; esac
name="$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$url")"
admin="$(node -e 'const u=new URL(process.argv[1]); u.pathname="/postgres"; console.log(u.toString())' "$url")"
psql "$admin" -tAc "SELECT 1 FROM pg_database WHERE datname = '$name'" | grep -q 1 || psql "$admin" -c "CREATE DATABASE \"$name\""
DATABASE_URL="$url" DATABASE_URL_UNPOOLED="$url" npx drizzle-kit push --force
