#!/bin/sh
# refresh.sh — pipeline de atualização dentro do container.
#
# 1. Baixa XLSX do Supabase Storage
# 2. Roda fetch-data.cjs (processa XLSX → data/*.json)
# 3. Build (data.js + app.bundle.js)
# 4. Copia pro document root do nginx
# 5. Sync pro Supabase Storage (backup)

set -e

# Carrega env exportado pelo entrypoint (cron não herda env do PID 1).
if [ -f /etc/cron-env ]; then
  set -a
  . /etc/cron-env
  set +a
fi

cd /app
LOG=/var/log/refresh.log
TS() { date '+%Y-%m-%d %H:%M:%S'; }

# Tee pra stdout (visível em Coolify logs) E pra arquivo (debug histórico).
exec > >(tee -a "$LOG") 2>&1

echo ""
echo "===== $(TS) refresh start ($1) ====="

SKIP_FETCH=0
if [ "$1" = "--boot" ] && [ -f data/_summary.json ]; then
  age=$(( $(date +%s) - $(stat -c %Y data/_summary.json 2>/dev/null || echo 0) ))
  if [ "$age" -lt 86400 ]; then
    echo "[$(TS)] boot: dados frescos ($age s) — pulando fetch (rebuild+copy só)"
    SKIP_FETCH=1
  fi
fi

if [ "$SKIP_FETCH" = "0" ]; then
  # Baixa XLSX atualizado do Supabase Storage
  if [ -f /app/download-xlsx.sh ]; then
    /app/download-xlsx.sh || echo "[$(TS)] download-xlsx falhou (continua com dados existentes)"
  fi

  echo "[$(TS)] fetch-data.cjs"
  node fetch-data.cjs || echo "[$(TS)] fetch-data falhou (continua)"
fi

if [ -f data/movimentos.json ]; then
  echo "[$(TS)] build-data.cjs"
  node build-data.cjs
  echo "[$(TS)] build-data-extras.cjs"
  node build-data-extras.cjs 2>/dev/null || true
  echo "[$(TS)] build-jsx.cjs"
  node build-jsx.cjs
  cp -f data.js app.bundle.js /usr/share/nginx/html/
  cp -f data-extras.js /usr/share/nginx/html/ 2>/dev/null || true
  cp -f report*.json /usr/share/nginx/html/ 2>/dev/null || true
  echo "[$(TS)] refresh OK — data.js atualizado em $(stat -c %y /usr/share/nginx/html/data.js)"

  # Sync pro Supabase Storage (se configurado)
  if [ -f /app/sync-supabase.sh ]; then
    /app/sync-supabase.sh || echo "[$(TS)] sync-supabase falhou (continua)"
  fi
else
  echo "[$(TS)] data/movimentos.json ausente — pulando build (servindo dados antigos)"
fi

echo "===== $(TS) refresh end ====="
