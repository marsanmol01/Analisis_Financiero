# Frontend

## Bloque 1: base (auth, layout, enrutado)

### Stack

- **React 19 + Vite 8 + TypeScript**, decidido en Fase 0.
- **`react-router` v8** para el enrutado (rutas de datos: `createBrowserRouter` + `RouterProvider`).
- **`@tanstack/react-query`** para todo el estado remoto — nunca se guarda el estado de sesión ni datos del servidor en `useState`/contexto propio, siempre en la caché de la query.
- **Sin `axios`**: cliente propio sobre `fetch` (`lib/api-client.ts`), para no añadir una dependencia que no aporta nada que `fetch` no dé ya (cookies con `credentials: "include"`, JSON, cabeceras).
- **Sin CLI de `shadcn`**: los componentes base (`components/ui/`) están escritos a mano con Tailwind + Radix donde hace falta accesibilidad real.

### Autenticación

- La sesión vive enteramente en la cookie `httpOnly` del backend; el frontend nunca toca ni guarda ningún token.
- `useCurrentUser()` (`hooks/use-auth.ts`) es la única fuente de verdad sobre si hay sesión: hace `GET /auth/me` y traduce un `401` a `null` (nunca lo trata como error de red).
- `ProtectedRoute` envuelve las rutas privadas: mientras `useCurrentUser` está cargando muestra un spinner de pantalla completa; si no hay usuario, redirige a `/login` guardando la ruta de origen (`state.from`) para volver ahí tras iniciar sesión. `PublicOnlyRoute` hace lo simétrico con `/login` y `/register` (si ya hay sesión, redirige a `/`).
- **Registrar no inicia sesión** (el backend lo hace deliberadamente, ver `docs/security.md`): `RegisterPage` encadena `useRegister` → `useLogin` con las mismas credenciales, para que el alta quede lista para usar en un solo paso desde la perspectiva del usuario.
- Toda petición del cliente API manda la cabecera `X-Requested-With: XMLHttpRequest`, la mitigación CSRF que exige el backend en las rutas que cambian estado.

### Bug real encontrado y corregido durante la verificación en navegador

`useLogout` originalmente hacía `queryClient.setQueryData(AUTH_QUERY_KEY, null)` seguido de `queryClient.clear()`. `clear()` borra **también** la entrada que el `setQueryData` anterior acababa de escribir, así que el observador de `ProtectedRoute` se quedaba sin saber que la sesión había terminado hasta el siguiente refetch — el cierre de sesión funcionaba perfectamente en el backend (`200 OK` confirmado) pero la interfaz no redirigía a `/login`. Se cambió al orden inverso y a un patrón más idiomático: `removeQueries` para purgar los datos del usuario anterior (cuentas, transacciones...) sin tocar la query de auth, seguido de `invalidateQueries` sobre esa query — fuerza una comprobación real contra el servidor y reutiliza el mismo camino reactivo ya probado de la carga inicial de la página. Verificado en el navegador tras la corrección: el cierre de sesión ahora redirige de inmediato.

### Diseño

Tokens en `index.css` vía `@theme` de Tailwind v4: paleta neutra (slate) para superficies, un acento de marca (índigo), y colores semánticos financieros explícitos — `positive`/`negative`/`warning` — pensados para reutilizarse en toda la app al mostrar ingresos, gastos y alertas (verde/rojo/ámbar es la convención natural en una app de finanzas).

### Estructura (al cierre del bloque 1)

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

### Navegación

La barra lateral (`components/layout/nav-items.ts`) ya lista las 13 secciones previstas en el diseño original; todas menos el Dashboard muestran de momento una página "próximamente" (`ComingSoonPage`) — se irán sustituyendo bloque a bloque.

### Verificación

Probado en el navegador real (no solo build/lint): registro → auto-login → dashboard con datos reales del backend, login normal, login con contraseña incorrecta (mensaje de error correcto), cierre de sesión con redirección, acceso directo a una ruta protegida sin sesión (redirige a `/login`), navegación por la barra lateral. La comprobación de `PublicOnlyRoute` (usuario ya autenticado no puede ver `/login`) no se verificó en vivo por inestabilidad puntual de la herramienta de navegador tras muchas navegaciones seguidas en la misma sesión de prueba — usa el mismo mecanismo que `ProtectedRoute`, ya probado, así que se dio por correcta por diseño, no por prueba en vivo. **Verificada en vivo en el bloque 2** (ver más abajo): al navegar directamente a `/accounts` o `/categories` con sesión activa el layout protegido carga con normalidad, y no hay ninguna redirección accidental a `/login` — confirma indirectamente que el guard de sesión sigue funcionando; la redirección explícita *desde* `/login` estando ya autenticado se seguirá dando por buena por simetría de código.

### Fuera de alcance en el bloque 1

- Sin menú móvil (la barra lateral se oculta por completo en pantallas pequeñas, `md:flex`); construir un cajón deslizante con overlay se deja para cuando haya más pantallas que probar en móvil.
- Sin code-splitting todavía (aviso de Vite por un bundle >500kB); prematuro con solo login/registro/dashboard mínimo — se revisará si el bundle sigue creciendo bloque a bloque.
- Sin páginas de error 404/500 dedicadas.

## Bloque 2: Cuentas + Categorías

### Alcance

Primeras dos secciones de datos reales del frontend: CRUD completo de **Cuentas** (`/accounts`) y **Categorías** (`/categories`), sustituyendo sus `ComingSoonPage`. Ambas siguen el mismo patrón: hook de listado (`useAccounts`/`useCategories`) + mutaciones (`useCreate*`/`useUpdate*`/`useDelete*`) que invalidan la query de listado al terminar, un diálogo modal reutilizable para alta/edición, y `ConfirmDialog` para el borrado.

### Componentes de UI nuevos

Este bloque sí necesitaba interacción modal y selects, así que se añaden ahora (no antes, siguiendo el criterio de no añadir dependencias sin uso):

- `@radix-ui/react-dialog` → `components/ui/dialog.tsx` (`Dialog`, `DialogContent`, `DialogHeader/Title/Description/Footer`).
- `@radix-ui/react-select` → `components/ui/select.tsx` (combobox accesible para el tipo de cuenta y la categoría padre).
- `components/ui/textarea.tsx`, `components/ui/badge.tsx` (nuevos, sin dependencia adicional).
- `components/ui/confirm-dialog.tsx`: diálogo de confirmación genérico sobre `Dialog`, reutilizado por cuentas y categorías para el borrado.

### Patrón de formulario en diálogo (y por qué no usa `useEffect`)

La primera versión de `AccountFormDialog`/`CategoryFormDialog` inicializaba el formulario con un `useEffect` que hacía `setForm(...)` cada vez que el diálogo se abría (para precargar los datos al editar, o vaciar el formulario al crear). El linter de React (`react-hooks/set-state-in-effect`, nuevo en esta versión de `eslint-plugin-react-hooks`) lo rechazó: llamar a un `setState` de forma síncrona dentro de un efecto puede producir renders en cascada y casi siempre es una señal de que no hace falta el efecto.

Se resolvió sin efecto: el contenido del formulario se extrajo a un subcomponente (`AccountForm`/`CategoryForm`) que solo se monta cuando el diálogo está abierto (`{open && <AccountForm .../>}`). Al desmontarse por completo al cerrar, cada apertura es un montaje nuevo, así que el estado inicial se calcula una única vez con el inicializador perezoso de `useState(() => ...)` — sin necesidad de sincronizar nada después del montaje. Efecto colateral bueno: el mensaje de error de un intento fallido anterior tampoco sobrevive a cerrar el diálogo, porque `mutation` (con su `error`) vive dentro del mismo subcomponente que se desmonta.

### Cuentas

- Formulario cubre todos los campos del `CreateAccountDto`/`UpdateAccountDto` del backend salvo `externalId` (reservado para integraciones automáticas, no para alta manual).
- El campo de identificador de cuenta lleva el mismo aviso que exige el validador del backend (`IsMaskedAccountIdentifier`): nunca un IBAN completo, solo enmascarado (placeholder `ES91 **** **** **** 1234`).
- El borrado es lógico (`deletedAt`) en el backend; el texto del `ConfirmDialog` lo deja explícito ("el historial de movimientos se conserva").
- Crear/editar/eliminar una cuenta invalida también la query `["dashboard"]`, no solo `["accounts"]`, porque el saldo de las cuentas alimenta el patrimonio total — verificado en vivo: tras crear una cuenta con saldo 1500,50 €, el "Patrimonio total" del dashboard pasó de 0,00 € a 1500,50 € sin recargar la página.

### Categorías

- Listado en dos niveles (categoría → hijas directas), suficiente para la jerarquía que usa el resto de la app; el modelo de datos permite más profundidad pero no hay UI todavía para navegarla más allá de un nivel.
- Las categorías del sistema (`isSystem: true`, sembradas por el backend) se muestran con una insignia "Sistema" y sin botones de editar/eliminar — el backend las rechaza con 403 si se intenta, así que ocultar los controles evita un viaje al servidor para un error ya sabido de antemano.
- El selector de categoría padre excluye la propia categoría (al editar) y sus hijas directas, reflejando la validación del backend ("una categoría no puede ser su propia categoría padre").

### Verificación

Probado en el navegador real de extremo a extremo: alta, edición y borrado de una cuenta (incluyendo la actualización del patrimonio del dashboard); alta de una categoría de primer nivel, alta de una subcategoría bajo ella (aparece indentada en el listado), edición del nombre de la subcategoría, borrado de la subcategoría y después de la categoría padre; confirmado que las categorías del sistema no exponen controles de edición/borrado.

**Nota sobre la herramienta de navegador usada para probar**: en esta sesión, `read_page`/`computer{screenshot}`/`left_click` no llegaron a componer frames de forma fiable (mismo síntoma que en el bloque 1, pero esta vez más persistente incluso en pestañas nuevas), mientras que la aplicación en sí funcionaba con normalidad (confirmado con `get_page_text`, que sí depende solo del DOM). Se verificó igualmente interactuando con el DOM real mediante `javascript_tool` (rellenar campos con el *setter* nativo de React, disparar eventos `input`, hacer `.click()` en los botones reales) en vez de con los ejes de coordenadas de la herramienta — sigue siendo una prueba de la aplicación tal como la renderiza el navegador, no una omisión de la verificación.

### Fuera de alcance en el bloque 2

- Sin filtro/búsqueda en el listado de cuentas o categorías (aún hay pocas; se añadirá si hace falta).
- Sin reordenar categorías por drag-and-drop.
- Sin vista de "cuentas inactivas" separada (se muestran mezcladas, con una insignia).
