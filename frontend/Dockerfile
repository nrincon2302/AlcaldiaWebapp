# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

# Sin defaults: los valores vienen exclusivamente del .env vía docker-compose
ARG VITE_API_URL
ARG VITE_SHINY_URL
ARG VITE_CAPTURA_BASE
ARG VITE_DDC_PQRSD
ARG VITE_DDC_CALPROC
ARG VITE_DDC_COTEL
ARG VITE_DDC_COVRT
ARG VITE_DDC_COPR_CAPINS
ARG VITE_DDC_COPR_STDYPRTC
ARG VITE_DDC_SATEXP_PR
ARG VITE_DDC_SATEXP_CT
ARG VITE_DDC_SATEXP_CV

ENV VITE_API_URL=$VITE_API_URL \
    VITE_SHINY_URL=$VITE_SHINY_URL \
    VITE_CAPTURA_BASE=$VITE_CAPTURA_BASE \
    VITE_DDC_PQRSD=$VITE_DDC_PQRSD \
    VITE_DDC_CALPROC=$VITE_DDC_CALPROC \
    VITE_DDC_COTEL=$VITE_DDC_COTEL \
    VITE_DDC_COVRT=$VITE_DDC_COVRT \
    VITE_DDC_COPR_CAPINS=$VITE_DDC_COPR_CAPINS \
    VITE_DDC_COPR_STDYPRTC=$VITE_DDC_COPR_STDYPRTC \
    VITE_DDC_SATEXP_PR=$VITE_DDC_SATEXP_PR \
    VITE_DDC_SATEXP_CT=$VITE_DDC_SATEXP_CT \
    VITE_DDC_SATEXP_CV=$VITE_DDC_SATEXP_CV

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