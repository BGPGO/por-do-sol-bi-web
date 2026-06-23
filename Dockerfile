FROM nginx:alpine

# Node 20 + cron + ferramentas mínimas pro ETL diário
# icu-data-full: sem ele o Node do Alpine só formata en-US, e o REFRESH_DATE
# ("Atualizado em") sai "06/23/2026, 03:52 PM" em vez de "23/06/2026, 15:52".
RUN apk add --no-cache nodejs npm dcron tini ca-certificates curl icu-data-full \
 && mkdir -p /app /var/log

WORKDIR /app

# Deps Node primeiro (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Scripts ETL + adapters
COPY adapters/ ./adapters/
COPY fetch-data.cjs build-data.cjs build-data-extras.cjs build-jsx.cjs ./
COPY bi.config.js ./
COPY components.jsx pages-1.jsx pages-2.jsx pages-3.jsx pages-4.jsx ./
COPY page-dre.jsx page-orcamento.jsx upsell-pages.jsx ./

# Site estático servido pelo nginx
COPY index.html styles.css /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Seed inicial dos artefatos buildados (sobrescritos pelo cron)
COPY data.js app.bundle.js /usr/share/nginx/html/
COPY data-extras.js /usr/share/nginx/html/
COPY report*.json /usr/share/nginx/html/

# Cron + entrypoint
COPY crontab /etc/crontabs/root
COPY refresh.sh entrypoint.sh download-xlsx.sh sync-supabase.sh /app/
RUN sed -i 's/\r$//' /app/*.sh /etc/crontabs/root \
 && chmod +x /app/refresh.sh /app/entrypoint.sh /app/download-xlsx.sh /app/sync-supabase.sh

# Env vars padrão (sobrescritas pelo Coolify)
ENV XLSX_BASE_PATH=/app/workspace/bases
ENV BI_SLUG=por-do-sol

EXPOSE 80
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/entrypoint.sh"]
