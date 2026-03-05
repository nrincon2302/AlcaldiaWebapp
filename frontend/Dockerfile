# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Serve ────────────────────────────────────────────────────────────────────
FROM nginx:alpine

# Instalar openssl para generar el certificado autofirmado durante el build
RUN apk add --no-cache openssl

# IP del servidor (usada como CN y SAN del certificado)
ARG SERVER_IP=10.110.33.36

# Generar certificado autofirmado válido 365 días para la IP del servidor
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/key.pem \
      -out    /etc/nginx/ssl/cert.pem \
      -subj   "/CN=${SERVER_IP}" \
      -addext "subjectAltName=IP:${SERVER_IP}"

# Copiar el build del frontend
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar la configuración de nginx (sustituye la config por defecto)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer ambos puertos
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- --no-check-certificate https://localhost || exit 1