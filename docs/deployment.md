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
- **`apps/web/Dockerfile`**: compila con Vite (`VITE_API_URL` se hornea en el bundle en tiempo de build — cambiarlo exige reconstruir la imagen, ver más abajo) y sirve los estáticos con `nginx:alpine` + [`nginx.conf`](../apps/web/nginx.conf) (con fallback a `index.html` para que las rutas de `react-router` funcionen con recarga directa, y proxy interno de `/api/*` hacia el contenedor `api` — ver "Un único origen" más abajo).

## Un único origen: nginx hace de proxy hacia la API

El navegador **nunca** habla directamente con el contenedor `api`: nginx reenvía internamente todo lo que llega a `/api/*` hacia `http://api:3000/` dentro de la red de Docker (`apps/web/nginx.conf`). Así, `VITE_API_URL=/api` (una ruta relativa, no una URL absoluta) y todo — frontend y API — se sirve desde el mismo origen (mismo host y puerto) que ve el navegador, sea `localhost:8080`, la IP de la LAN, o el hostname de Tailscale.

Se eligió este diseño **después de un fallo real**: la primera versión exponía la API en un puerto distinto (8443) del frontend (443) sobre el mismo hostname de Tailscale. El servidor respondía perfectamente a esa petición (confirmado reproduciéndola por `curl` con una sesión real), pero **Safari de iOS no cargaba los datos del dashboard tras un login correcto** — un fallo específico del navegador móvil ante ese diseño de dos puertos, no del servidor. Unificar todo bajo un único origen elimina la ambigüedad de raíz, en vez de depender de que cada navegador interprete igual el `SameSite` de la cookie entre puertos distintos del mismo host.

Consecuencia en el código: `api-client.ts` concatena `API_URL + path` como texto plano en vez de usar `new URL(path, base)` — el constructor `URL` exige una base absoluta y además una ruta que empieza por `/` sustituye el path completo de la base (perdería el prefijo `/api`). Y `main.ts` confía en `X-Forwarded-For` con `trust proxy: "uniquelocal"` (loopback + redes privadas como la de Docker), no `"loopback"` a secas, porque ahora la API recibe la conexión desde nginx (red interna de Docker), no desde localhost directo.

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
3. Con el PC ya en la red Tailscale (`tailscale status` debe listar el propio dispositivo), activar Tailscale Serve para publicar el frontend (que a su vez hace de proxy hacia la API — ver "Un único origen" más arriba, un solo mapeo es suficiente):

   ```bash
   tailscale serve --bg http://127.0.0.1:8080
   ```

4. Averiguar el hostname asignado: `tailscale status` (o `tailscale serve status`) — tiene forma `equipo.tailXXXXX.ts.net`.
5. Actualizar el `.env` de este repo:
   - `WEB_ORIGIN=http://localhost:5173,https://equipo.tailXXXXX.ts.net`
   - `VITE_API_URL=/api`
6. Reconstruir y relanzar: `docker compose build web && docker compose up -d api web`.
7. Desde el iPhone/iPad, con la app de Tailscale activa, entrar en `https://equipo.tailXXXXX.ts.net` desde Safari.

## Fuera de alcance por ahora

- No se expone nada a internet (ni Tailscale Funnel, ni puertos reenviados en el router) — deliberado, dado que son datos financieros reales.
- `POSTGRES_PASSWORD` sigue siendo el valor de ejemplo (`changeme`) salvo que se haya cambiado explícitamente — ver aviso aparte si no se ha hecho todavía.
