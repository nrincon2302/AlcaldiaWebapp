# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

# Sin defaults: los valores vienen exclusivamente del .env vía docker-compose
ARG VITE_API_URL
ARG VITE_SHINY_URL

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Serve ────────────────────────────────────────────────────────────────────
# HIGH: Nginx < 1.29.7 — mainline-alpine garantiza versión >= 1.29.7
FROM nginx:mainline-alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf.template /etc/nginx/nginx.conf.template

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- --no-check-certificate https://localhost || exit 1