# Imagen de produccion del frontend (React + Vite). Se compila a estaticos y se sirven con
# nginx — Vite no necesita un servidor Node en produccion.

FROM node:20-bookworm-slim AS build
WORKDIR /app

# "npm ci" en la raiz instala las dependencias de TODOS los workspaces (asi lo exige el
# lockfile), incluido argon2 del backend, que compila un modulo nativo en la instalacion.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/web apps/web

# VITE_API_URL se inyecta en el bundle en tiempo de compilacion (Vite no lee variables de entorno
# en tiempo de ejecucion) — no es un secreto, es solo la URL publica de la API.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
