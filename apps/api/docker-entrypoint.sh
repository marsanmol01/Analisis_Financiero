#!/bin/sh
set -e

# El CLI de Prisma busca prisma.config.ts en el directorio de trabajo actual, asi que hay que
# ejecutarlo desde apps/api (igual que en desarrollo, ver package.json).
# Aplica cualquier migracion pendiente antes de arrancar (idempotente: no hace nada si la base
# de datos ya esta al dia, como es el caso normal en cada reinicio).
(cd apps/api && npx prisma migrate deploy)

exec node apps/api/dist/src/main.js
