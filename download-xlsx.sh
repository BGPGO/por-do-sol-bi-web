#!/bin/sh
# download-xlsx.sh — baixa os XLSX do Por do Sol do Supabase Storage pro container.
#
# Supabase bucket: bi-excel / pordosol-*
# Local path: /app/workspace/bases/ (mesmo layout que o Drive)
# Requer env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY.

set -e

TS() { date '+%Y-%m-%d %H:%M:%S'; }

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "[$(TS)] download-xlsx: SUPABASE_URL ou SUPABASE_SERVICE_KEY nao definido — pulando"
  exit 0
fi

BUCKET="bi-excel"
PREFIX="pordosol-bases"
BASES_DIR="/app/workspace/bases"
mkdir -p "$BASES_DIR"

download() {
  local supa_file="$1"
  local local_path="$2"

  local status=$(curl -s -o "$local_path" -w "%{http_code}" \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${PREFIX}/${supa_file}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}")

  if [ "$status" = "200" ]; then
    echo "[$(TS)]   ok: $(basename "$local_path")"
  else
    echo "[$(TS)]   FAIL ($status): ${PREFIX}/${supa_file}"
    rm -f "$local_path"
  fi
}

echo "[$(TS)] download-xlsx: baixando bases Por do Sol..."
download "2026.xlsx"                "${BASES_DIR}/2026.xlsx"
download "recebimento-comp.xls"    "${BASES_DIR}/Recebimeto Comp.xls"
download "pagamento-comp.xls"      "${BASES_DIR}/Pagamento Comp.xls"
download "financeiro-pordosol.xlsx" "${BASES_DIR}/FINANCEIRO POR DO SOL.xlsx"

echo "[$(TS)] download-xlsx: concluido"
