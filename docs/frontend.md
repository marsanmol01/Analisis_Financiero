# Frontend — Bloque 1: base (auth, layout, enrutado)

## Stack

- **React 19 + Vite 8 + TypeScript**, decidido en Fase 0.
- **`react-router` v8** para el enrutado (rutas de datos: `createBrowserRouter` + `RouterProvider`).
- **`@tanstack/react-query`** para todo el estado remoto — nunca se guarda el estado de sesión ni datos del servidor en `useState`/contexto propio, siempre en la caché de la query.
- **Sin `axios`**: cliente propio sobre `fetch` (`lib/api-client.ts`), para no añadir una dependencia que no aporta nada que `fetch` no dé ya (cookies con `credentials: "include"`, JSON, cabeceras).
- **Sin CLI de `shadcn`**: los componentes base (`components/ui/`) están escritos a mano con Tailwind + Radix donde hace falta accesibilidad real (`Label` por ahora; `Dialog`/`Select`/`Tabs` se añadirán en los bloques que los necesiten, no antes — evita dependencias sin usar).

## Autenticación

- La sesión vive enteramente en la cookie `httpOnly` del backend; el frontend nunca toca ni guarda ningún token.
- `useCurrentUser()` (`hooks/use-auth.ts`) es la única fuente de verdad sobre si hay sesión: hace `GET /auth/me` y traduce un `401` a `null` (nunca lo trata como error de red).
- `ProtectedRoute` envuelve las rutas privadas: mientras `useCurrentUser` está cargando muestra un spinner de pantalla completa; si no hay usuario, redirige a `/login` guardando la ruta de origen (`state.from`) para volver ahí tras iniciar sesión. `PublicOnlyRoute` hace lo simétrico con `/login` y `/register` (si ya hay sesión, redirige a `/`).
- **Registrar no inicia sesión** (el backend lo hace deliberadamente, ver `docs/security.md`): `RegisterPage` encadena `useRegister` → `useLogin` con las mismas credenciales, para que el alta quede lista para usar en un solo paso desde la perspectiva del usuario.
- Toda petición del cliente API manda la cabecera `X-Requested-With: XMLHttpRequest`, la mitigación CSRF que exige el backend en las rutas que cambian estado.

## Bug real encontrado y corregido durante la verificación en navegador

`useLogout` originalmente hacía `queryClient.setQueryData(AUTH_QUERY_KEY, null)` seguido de `queryClient.clear()`. `clear()` borra **también** la entrada que el `setQueryData` anterior acababa de escribir, así que el observador de `ProtectedRoute` se quedaba sin saber que la sesión había terminado hasta el siguiente refetch — el cierre de sesión funcionaba perfectamente en el backend (`200 OK` confirmado) pero la interfaz no redirigía a `/login`. Se cambió al orden inverso y a un patrón más idiomático: `removeQueries` para purgar los datos del usuario anterior (cuentas, transacciones...) sin tocar la query de auth, seguido de `invalidateQueries` sobre esa query — fuerza una comprobación real contra el servidor y reutiliza el mismo camino reactivo ya probado de la carga inicial de la página. Verificado en el navegador tras la corrección: el cierre de sesión ahora redirige de inmediato.

## Diseño

Tokens en `index.css` vía `@theme` de Tailwind v4: paleta neutra (slate) para superficies, un acento de marca (índigo), y colores semánticos financieros explícitos — `positive`/`negative`/`warning` — pensados para reutilizarse en toda la app al mostrar ingresos, gastos y alertas (verde/rojo/ámbar es la convención natural en una app de finanzas).

## Estructura

```
src/
  lib/          cliente API, query client, cn(), formato de moneda/porcentaje
  types/        tipos compartidos con el backend (minimos, se amplian por bloque)
  hooks/        use-auth, use-dashboard (se ira ampliando)
  components/
    ui/         Button, Input, Label, Card, FormError, Spinner
    layout/     Sidebar, Topbar, AppLayout
    auth/       ProtectedRoute, PublicOnlyRoute
  pages/
    auth/       LoginPage, RegisterPage
    dashboard/  DashboardPage (version minima de este bloque)
    coming-soon-page.tsx   placeholder para las secciones de los proximos bloques
```

## Navegación

La barra lateral (`components/layout/nav-items.ts`) ya lista las 13 secciones previstas en el diseño original; todas menos el Dashboard muestran de momento una página "próximamente" (`ComingSoonPage`) — se irán sustituyendo bloque a bloque.

## Verificación

Probado en el navegador real (no solo build/lint): registro → auto-login → dashboard con datos reales del backend, login normal, login con contraseña incorrecta (mensaje de error correcto), cierre de sesión con redirección, acceso directo a una ruta protegida sin sesión (redirige a `/login`), navegación por la barra lateral. La comprobación de `PublicOnlyRoute` (usuario ya autenticado no puede ver `/login`) no se verificó en vivo por inestabilidad puntual de la herramienta de navegador tras muchas navegaciones seguidas en la misma sesión de prueba — usa el mismo mecanismo que `ProtectedRoute`, ya probado, así que se da por correcta por diseño, no por prueba en vivo; queda pendiente de una verificación en vivo en el próximo bloque.

## Fuera de alcance en este bloque

- Sin menú móvil (la barra lateral se oculta por completo en pantallas pequeñas, `md:flex`); construir un cajón deslizante con overlay se deja para cuando haya más pantallas que probar en móvil.
- Sin code-splitting todavía (aviso de Vite por un bundle >500kB); prematuro con solo login/registro/dashboard mínimo — se revisará si el bundle sigue creciendo bloque a bloque.
- Sin páginas de error 404/500 dedicadas.
