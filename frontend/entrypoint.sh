#!/bin/sh
set -e

# Sustituye SOLO nuestras variables en el template.
# Las variables propias de nginx ($host, $remote_addr, etc.) quedan intactas.
envsubst '${SERVER_IP} ${SHINY_HOST} ${BACKEND_HOST}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'