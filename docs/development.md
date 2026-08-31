# Desarrollo local

## Requisitos

- Node.js 20+
- Docker (PostgreSQL local)

## Primeros pasos

```bash
cp .env.example .env
# Generar SESSION_SECRET real:
openssl rand -base64 48
# Pegar el resultado en .env

docker compose up -d postgres
npm install
npm run prisma:migrate
```

## Comandos habituales

| Comando | Qué hace |
|---|---|
| `npm run dev:api` | Levanta la API NestJS en modo watch (`localhost:3000`) |
| `npm run dev:web` | Levanta el frontend Vite (`localhost:5173`) |
| `npm run test:api` | Tests unitarios del backend (Jest) |
| `npm run lint:api` | Lint del backend |
| `npm run prisma:generate` | Regenera el cliente Prisma tras cambiar `schema.prisma` |
| `npm run prisma:migrate` | Crea/aplica una migración de desarrollo |

## Datos de desarrollo

Nunca uses datos bancarios reales en local. Los fixtures ficticios se añaden en `fixtures/` en un paso posterior (Fase 1/2), junto con el importador CSV/XLSX.
