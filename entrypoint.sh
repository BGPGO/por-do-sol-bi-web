#!/bin/sh
# entrypoint.sh — boot do container.
#
# 1. Roda refresh.sh uma vez (atualiza dados no boot)
# 2. Inicia cron em background (refresh 2x/dia)
# 3. Inicia nginx em foreground (PID 1)

set -e

mkdir -p /var/log
touch /var/log/refresh.log

# dcron NÃO herda env vars do PID 1 — exporta credenciais pra arquivo
# que refresh.sh lê. Sem isso, download-xlsx falha por SUPABASE_* undefined.
env | grep -E '^(XLSX_|BI_|COOLIFY_|SUPABASE_)' > /etc/cron-env || true
chmod 600 /etc/cron-env

# Boot refresh em background — não atrasa o nginx ficar pronto.
( /app/refresh.sh --boot & ) &

# Cron daemon (dcron) em background.
crond -b -L /var/log/cron.log

# Nginx em foreground (mantém PID 1, recebe sinais do tini)
exec nginx -g 'daemon off;'
