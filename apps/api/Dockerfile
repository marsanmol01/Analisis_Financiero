# Imagen de produccion del backend (NestJS). Multi-stage: se compila en "build" y el contenedor
# final solo lleva lo necesario para ejecutar, nunca el codigo fuente TS ni herramientas de build
# extra. Se usa la misma base Debian (bookworm-slim) en build y runtime para que los binarios
# nativos (Prisma, argon2) sean compatibles entre ambas etapas.

FROM node:20-bookworm-slim AS build
WORKDIR /app

# argon2 (hash de contrasenas) no trae un binario precompilado para esta plataforma y compila un
# modulo nativo en la instalacion (node-gyp) — necesita Python y un compilador de C++. Solo estan
# en esta etapa de build, nunca llegan a la imagen final de runtime.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copiamos solo los package.json de todos los workspaces primero para aprovechar la cache de
# Docker: si el codigo cambia pero las dependencias no, "npm ci" no se repite.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/api apps/api

# "prisma generate" necesita que DATABASE_URL exista como variable de entorno, pero no se conecta
# a ninguna base de datos real (solo genera el cliente a partir del schema) — este valor de
# relleno nunca se usa para nada mas y no es un secreto real.
ARG DATABASE_URL="postgresql://build:build@build:5432/build"
ENV DATABASE_URL=$DATABASE_URL
RUN npm run prisma:generate
RUN npm run build:api

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# El motor de "prisma migrate deploy" (no las consultas de la app, que van por el adaptador pg)
# necesita libssl para funcionar.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["sh", "apps/api/docker-entrypoint.sh"]
