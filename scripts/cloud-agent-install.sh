#!/usr/bin/env bash
set -euo pipefail

cd /workspace

npm ci
npx prisma generate

if [[ -x ./scripts/sync-env-keys.sh ]]; then
  ./scripts/sync-env-keys.sh .env
fi
