# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

ARG VITE_API_URL=https://10.110.33.36
ARG VITE_SHINY_URL=

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Serve ────────────────────────────────────────────────────────────────────
FROM nginx:alpine

RUN apk add --no-cache openssl

# SERVER_IP solo se usa para generar el certificado autofirmado en build time.
# La configuración de nginx en runtime viene de variables de entorno (entrypoint.sh).
ARG SERVER_IP=10.110.33.36
RUN mkdir -p /etc/nginx/ssl && \
    # Usar el default si el ARG llega vacío (ej. docker-compose pasa "" cuando no está en .env)
    HOST="${SERVER_IP:-10.110.33.36}" && \
    # Detectar IP (cuatro octetos) vs hostname para elegir IP: o DNS: en el SAN
    if echo "$HOST" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then \
      SAN="IP:${HOST}"; \
    else \
      SAN="DNS:${HOST}"; \
    fi && \
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/key.pem \
      -out    /etc/nginx/ssl/cert.pem \
      -subj   "/CN=${HOST}" \
      -addext "subjectAltName=${SAN}"

COPY --from=build /app/dist /usr/share/nginx/html

# Template: el entrypoint lo procesa con envsubst al arrancar
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Entrypoint: sustituye vars y lanza nginx
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- --no-check-certificate https://localhost || exit 1