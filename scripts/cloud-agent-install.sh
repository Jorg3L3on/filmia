#!/usr/bin/env bash
set -euo pipefail

cd /workspace

npm ci

if [[ -x ./scripts/sync-env-keys.sh ]]; then
  ./scripts/sync-env-keys.sh .env
fi
