#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

upsert_env() {
  local key="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    return 0
  fi

  if rg -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$ENV_FILE"
  else
    printf '\n%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

upsert_env "DATABASE_URL" "${DATABASE_URL:-}"
upsert_env "DATABASE_URL_UNPOOLED" "${DATABASE_URL_UNPOOLED:-}"
upsert_env "TMDB_API_KEY" "${TMDB_API_KEY:-}"
upsert_env "OMDB_API_KEY" "${OMDB_API_KEY:-}"

echo "Sync listo en ${ENV_FILE}"
