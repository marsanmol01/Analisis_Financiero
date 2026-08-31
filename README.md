# Plataforma Financiera

Plataforma web personal para centralizar y analizar finanzas personales: importación de movimientos bancarios (CSV/XLSX), clasificación automática, detección de transferencias internas y gastos recurrentes, presupuestos, objetivos de ahorro y estadísticas.

Ver el diseño completo en la conversación de Fase 0 y en [`docs/`](docs/). Estado actual: **Fase 1 en marcha**.

## Estructura

```
apps/
  api/    Backend NestJS (monolito modular)
  web/    Frontend React + Vite
docs/     Documentación de arquitectura, seguridad, modelo de datos...
fixtures/ Datos ficticios para desarrollo (nunca datos reales)
```

## Requisitos

- Node.js 20 o superior
- Docker (para PostgreSQL en local)

## Puesta en marcha (desarrollo)

```bash
cp .env.example .env
# Genera un valor real para SESSION_SECRET, por ejemplo:
openssl rand -base64 48

docker compose up -d postgres

npm install
npm run prisma:migrate
npm run dev:api
npm run dev:web
```

La API queda en `http://localhost:3000`, el frontend en `http://localhost:5173`.

## Principios del proyecto

- Seguridad y privacidad por diseño.
- Nunca se almacenan credenciales bancarias, PIN, códigos SMS ni claves de firma.
- Los movimientos se importan manualmente (CSV/XLSX); no hay conexión directa a bancos todavía.
- Reglas deterministas antes que IA; toda automatización es revisable.
- Ningún dato financiero real debe entrar en el repositorio (ver [`SECURITY.md`](SECURITY.md)).
