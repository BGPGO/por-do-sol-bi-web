#!/bin/sh
# sync-supabase.sh — envia data.js, app.bundle.js e reports pro Supabase Storage.
#
# Chamado pelo refresh.sh após build bem-sucedido.
# Requer env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, BI_SLUG.

set -e

TS() { date '+%Y-%m-%d %H:%M:%S'; }

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "[$(TS)] sync-supabase: SUPABASE_URL ou SUPABASE_SERVICE_KEY não definido — pulando"
  exit 0
fi

SLUG="${BI_SLUG:-por-do-sol}"
BUCKET="bi-data"
cd /app

upload() {
  local file="$1"
  local name=$(basename "$file")
  local ct="${2:-application/octet-stream}"

  if [ ! -f "$file" ]; then
    echo "[$(TS)]   skip ${name} (não existe)"
    return
  fi

  local status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${SLUG}/${name}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: ${ct}" \
    -H "x-upsert: true" \
    --data-binary "@${file}")

  if [ "$status" = "200" ]; then
    echo "[$(TS)]   ${name} OK"
  else
    echo "[$(TS)]   ${name} FALHOU (HTTP ${status})"
  fi
}

echo "[$(TS)] sync-supabase: uploading para ${SUPABASE_URL}/storage/v1 bucket=${BUCKET} slug=${SLUG}"

upload data.js application/javascript
upload app.bundle.js application/javascript
upload data-extras.js application/javascript

for f in report*.json; do
  [ -f "$f" ] && upload "$f" application/json
done

echo "[$(TS)] sync-supabase: concluído"
