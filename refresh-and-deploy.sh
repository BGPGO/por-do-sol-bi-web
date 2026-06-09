#!/bin/bash
# Refresh data from Drive XLSX, rebuild, commit, push and deploy to Coolify
# Agendar no Windows Task Scheduler para 14:00, 17:00 e 22:00 BRT
#
# Comando para Task Scheduler:
#   Program: bash
#   Arguments: -c "cd /c/Users/bertu/Downloads/bi-blueprint-main/por-do-sol-bi-web && bash refresh-and-deploy.sh"

set -e
cd "$(dirname "$0")"

COOLIFY_TOKEN="55|jsrzS3qEfcI8gNXRIombOCx4tLPIm1tITZd8kAGO67394666"
COOLIFY_UUID="w10qex9dsvs1l71cu3iegk61"
COOLIFY_HOST="http://187.77.238.125:8000"

echo "=== $(date) === Refresh BI Por do Sol ==="

# 1. Fetch data (lê XLSX do Drive)
echo ">> fetch-data..."
node fetch-data.cjs

# 2. Build data.js
echo ">> build-data..."
node build-data.cjs

# 3. Build app.bundle.js
echo ">> build-jsx..."
node build-jsx.cjs

# 4. Smoke test
echo ">> smoke test..."
node -e "new Function(require('fs').readFileSync('app.bundle.js','utf8'))"

# 5. Sync com remote (evita rejeição se alguém pushou direto)
echo ">> git pull --rebase..."
git pull --rebase origin main || true

# 6. Commit + push (só se houve mudança)
if git diff --quiet data.js app.bundle.js data-extras.js 2>/dev/null; then
  echo ">> Sem mudanças nos dados — skip push"
else
  echo ">> Dados atualizados — commit + push..."
  git add data.js app.bundle.js data-extras.js report*.json
  git commit -m "auto: refresh dados $(date +%Y-%m-%d\ %H:%M)" --no-verify || true
  git push origin main
fi

# 7. Trigger Coolify deploy
echo ">> Deploy Coolify..."
curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_HOST/api/v1/deploy?uuid=$COOLIFY_UUID&force=false"

echo ""
echo "=== Done ==="
