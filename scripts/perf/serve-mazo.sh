#!/usr/bin/env bash
# Builds a production copy of a git ref against LOCAL Postgres and serves it (FIL-I58).
#   scripts/perf/serve-mazo.sh <label> [ref|WORKTREE] [port]   e.g. scripts/perf/serve-mazo.sh base sandbox 3061
# `WORKTREE` builds the current working tree, uncommitted changes included.
#
# `next start` normally refuses a local database (NODE_ENV guards in src/db/index.ts and
# src/instrumentation.ts), so the scratch copy relaxes those two guards. The scratch copy lives
# in $PERF_SCRATCH (default <tmp>/filmia-perf-builds/<label>); your working tree is untouched.
# Needs: local Postgres, DB $PERF_DB (default filmia_perf) with `npm run db:seed:audit` applied
# (DATABASE_URL=... npm run db:seed:audit), and a .env in the repo root (copied over).
# Then: PERF_BASE=http://127.0.0.1:<port> npm run perf:mazo -- --cpu=6
set -euo pipefail
label="${1:?label}"
ref="${2:-HEAD}"
port="${3:-3061}"
root="$(git rev-parse --show-toplevel)"
scratch="${PERF_SCRATCH:-${TMPDIR:-/tmp}/filmia-perf-builds}/$label"
db="postgresql://$(whoami)@localhost:5432/${PERF_DB:-filmia_perf}"

if [ "$ref" = "WORKTREE" ]; then
  mkdir -p "$scratch"
  [ -d "$scratch/node_modules" ] || cp -cR "$root/node_modules" "$scratch/node_modules"
  rsync -a --delete --exclude node_modules --exclude .next --exclude .git "$root/" "$scratch/"
elif [ ! -d "$scratch" ]; then
  mkdir -p "$(dirname "$scratch")"
  git -C "$root" worktree add --detach "$scratch" "$ref"
  cp -cR "$root/node_modules" "$scratch/node_modules"
  cp "$root/.env" "$scratch/.env"
fi
cd "$scratch"
sed -i '' 's/ && process.env.NODE_ENV !== "production" && localFetch/ \&\& localFetch/' src/db/index.ts
perl -0pi -e 's/process\.env\.FILMIA_LOCAL_PG === "1" &&\s*process\.env\.NODE_ENV !== "production"/process.env.FILMIA_LOCAL_PG === "1"/' src/instrumentation.ts
export FILMIA_LOCAL_PG=1 DATABASE_URL="$db" DATABASE_URL_UNPOOLED="$db" AUTH_URL="http://127.0.0.1:$port" AUTH_SECRET="local-only-perf"
npm run build
exec npx next start -H 127.0.0.1 -p "$port"
