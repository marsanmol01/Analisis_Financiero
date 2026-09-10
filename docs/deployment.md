# Despliegue autoalojado (Docker + Tailscale)

## Arquitectura

```
docker-compose.yml
├── postgres  (postgres:16-alpine, volumen persistente postgres_data)
├── api       (NestJS, imagen propia, apps/api/Dockerfile)
└── web       (React/Vite compilado a estático, servido por nginx, apps/web/Dockerfile)
```

Los tres contenedores corren siempre (`restart: unless-stopped`), sustituyendo a los servidores de desarrollo (`npm run dev:api` / `npm run dev:web`) que solo hacían falta durante Fase 0-4.

## Imágenes

- **`apps/api/Dockerfile`**: build multi-stage. La etapa de build instala `python3`/`make`/`g++` (necesarios solo para compilar el módulo nativo de `argon2`, nunca llegan a la imagen final) y compila con `nest build`. La imagen final ejecuta [`docker-entrypoint.sh`](../apps/api/docker-entrypoint.sh), que aplica `prisma migrate deploy` (idempotente: no hace nada si la base de datos ya está al día) antes de arrancar `node apps/api/dist/src/main.js`.
- **`apps/web/Dockerfile`**: compila con Vite (`VITE_API_URL` se hornea en el bundle en tiempo de build — cambiarlo exige reconstruir la imagen, ver más abajo) y sirve los estáticos con `nginx:alpine` + [`nginx.conf`](../apps/web/nginx.conf) (con fallback a `index.html` para que las rutas de `react-router` funcionen con recarga directa).

## Variables de entorno relevantes para producción

Todas viven en el `.env` de la raíz (nunca en git):

| Variable | Para qué |
|---|---|
| `NODE_ENV=production` (fijado por `docker-compose.yml`, no hace falta ponerlo en `.env`) | Activa `cookie.secure: true` en la sesión (exige HTTPS) y desactiva verbosidad de desarrollo |
| `WEB_ORIGIN` | Origen(es) permitido(s) por CORS. Debe incluir la URL https de Tailscale del frontend una vez montado (puede tener varios separados por coma, ej. para seguir usando `npm run dev` en local a la vez) |
| `VITE_API_URL` | URL pública donde el navegador debe llamar a la API. Se hornea al compilar `web` — si cambia, hay que `docker compose build web` de nuevo |
| `WEB_PORT` | Puerto del host donde nginx publica el frontend (por defecto 8080) |

`DATABASE_URL` **no** se coge del `.env` para el contenedor `api`: `docker-compose.yml` lo sobreescribe apuntando a `postgres` (el nombre del servicio en la red de Docker), no a `localhost`.

## Cookie de sesión y HTTPS

Con `NODE_ENV=production`, la cookie de sesión (`pf.sid`) exige `secure: true` — el navegador nunca la enviará por HTTP plano. Esto es intencional (no se baja la guardia de seguridad para pruebas locales): **el login solo persiste de verdad sirviendo la app por HTTPS**, que es justo lo que aporta Tailscale automáticamente (ver abajo). Verificado en local por HTTP sin sesión persistente (esperado) y el resto del flujo (CORS, conexión nginx → api → postgres) confirmado con una petición de login con credenciales incorrectas, que devolvió el error real de la API en vez de un fallo de red.

## Comandos básicos

```bash
# Reconstruir tras cambiar codigo o Dockerfiles
docker compose build api web

# Levantar/actualizar (nunca toca el volumen de postgres si su definicion no cambia)
docker compose up -d api web

# Logs
docker compose logs -f api
docker compose logs -f web
```

**Nunca** ejecutar `docker compose down -v` en este proyecto: `-v` borraría el volumen `postgres_data`, que contiene datos financieros reales. `docker compose down` (sin `-v`) o `docker compose stop` son seguros si hace falta parar los contenedores.

## Acceso desde el móvil/iPad: Tailscale

Se eligió Tailscale (VPN privada de malla, gratis para uso personal) en vez de exponer puertos a internet: la app solo es alcanzable desde los dispositivos que tú mismo autorizas en tu cuenta, con cifrado de extremo a extremo, y sin gestionar certificados a mano — Tailscale los emite automáticamente vía Let's Encrypt para tu subdominio `*.ts.net`.

### Lo que hay que instalar/configurar (fuera de este repo)

1. **Windows (este PC)**: instalar Tailscale (`winget install Tailscale.Tailscale` o desde tailscale.com/download) e iniciar sesión con una cuenta (Google/Microsoft/email — se crea en el propio flujo de Tailscale).
2. **iPhone y iPad**: instalar la app "Tailscale" desde el App Store, iniciar sesión con la **misma** cuenta.
3. Con el PC ya en la red Tailscale (`tailscale status` debe listar el propio dispositivo), activar Tailscale Serve para publicar la app dentro de la red privada — dos mapeos sobre el mismo hostname, uno para el frontend (443, implícito) y otro para la API (8443), evitando así cualquier cambio en las rutas actuales del backend:

   ```bash
   tailscale serve https / http://127.0.0.1:8080      # frontend (nginx)
   tailscale serve https:8443 / http://127.0.0.1:3000  # API
   ```

4. Averiguar el hostname asignado: `tailscale status` (o `tailscale serve status`) — tiene forma `equipo.tailXXXXX.ts.net`.
5. Actualizar el `.env` de este repo:
   - `WEB_ORIGIN=http://localhost:5173,https://equipo.tailXXXXX.ts.net`
   - `VITE_API_URL=https://equipo.tailXXXXX.ts.net:8443`
6. Reconstruir y relanzar: `docker compose build web && docker compose up -d api web` (el `api` no necesita rebuild, solo lee `WEB_ORIGIN` en caliente al arrancar — pero sí necesita reiniciarse para recogerlo).
7. Desde el iPhone/iPad, con la app de Tailscale activa, entrar en `https://equipo.tailXXXXX.ts.net` desde Safari.

### Por qué dos puertos en vez de una sola ruta con prefijo

Se evita deliberadamente montar la API bajo un prefijo como `/api` en el mismo puerto 443: el cliente (`apps/web/src/lib/api-client.ts`) construye las URLs combinando `VITE_API_URL` con rutas que empiezan por `/` (ej. `/auth/login`), y `new URL("/auth/login", "https://host/api")` en JavaScript **ignora** el `/api` del origen base (una ruta que empieza por `/` siempre sustituye el path completo). Usar un puerto distinto en el mismo hostname evita ese problema de raíz sin tocar código, y sigue siendo un solo certificado/hostname de Tailscale.

## Fuera de alcance por ahora

- No se expone nada a internet (ni Tailscale Funnel, ni puertos reenviados en el router) — deliberado, dado que son datos financieros reales.
- `POSTGRES_PASSWORD` sigue siendo el valor de ejemplo (`changeme`) salvo que se haya cambiado explícitamente — ver aviso aparte si no se ha hecho todavía.
