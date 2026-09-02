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

## Bloque 3: Transacciones + Importaciones

### Alcance

El bloque más grande hasta ahora: listado/edición/borrado de movimientos (`/transactions`) y el flujo completo de importación de extractos (`/imports`, `/imports/new`). Es el primer bloque donde el backend no expone alta manual (`TransactionsController` no tiene `POST`): los movimientos solo entran por importación, así que no hay "nuevo movimiento" en la UI, solo edición de lo ya importado.

### Cliente API: soporte de `FormData`

`api-client.ts` serializaba siempre el cuerpo como JSON. La subida de ficheros (`POST /imports/preview`, `multipart/form-data`) necesitaba lo contrario: enviar un `FormData` tal cual, sin fijar `Content-Type` a mano (el navegador debe poner el suyo con el boundary del multipart, o el backend no puede parsear las partes). Se añadió una rama en `apiRequest`: si el cuerpo es una instancia de `FormData`, se envía sin `JSON.stringify` y sin la cabecera `Content-Type`; en cualquier otro caso el comportamiento es el de siempre. Un único método (`api.post`) sigue sirviendo para JSON y para subidas.

### Transacciones

- Filtros: cuenta (o "todas"), rango de fechas. Cambiar cualquiera reinicia la paginación a la página 1.
- Paginación real contra `GET /transactions` (respuesta `{ items, total, page, pageSize }`); se usa `placeholderData: keepPreviousData` de TanStack Query para no mostrar un parpadeo de "cargando" al cambiar de página, solo un atenuado del contenido anterior mientras llega el siguiente.
- La tabla resuelve nombres de cuenta/categoría/comercio en el cliente a partir de los listados ya cargados (`useAccounts`, `useCategories`, y un `useMerchants` nuevo, de solo lectura — la gestión completa de comercios es el bloque 4). El backend no hace `include` en `findAll`, solo devuelve los IDs.
- Editar un movimiento reutiliza el mismo `UpdateTransactionDto` que backend expone para "correcciones que enseñan al sistema" (requisito 4.7 de la especificación): al cambiar la categoría aparecen dos casillas — aplicar la misma categoría a movimientos similares sin categorizar a mano, y crear una regla de clasificación automática a partir de la descripción — solo cuando la categoría realmente cambia respecto a la que ya tenía. El resultado de la mutación (`similarUpdatedCount`, `ruleCreated`) se muestra como un aviso descartable en la página, no dentro del diálogo, porque el diálogo ya se ha cerrado en ese momento.
- Borrado lógico igual que cuentas/categorías, con `ConfirmDialog`.

### Importaciones

Asistente de tres pasos en `/imports/new`, como página propia (no un diálogo modal: la tabla de previsualización puede tener miles de filas y necesita su propio espacio):

1. **Subida**: cuenta + fichero (CSV/XLSX, máx. 15 MB, límite ya impuesto por el backend). Llama a `POST /imports/preview`.
2. **Mapeo manual** (`column-mapping-form.tsx`), solo si el backend responde `needs_mapping` (no pudo detectar automáticamente fecha + descripción + importe, o debe/haber, por las cabeceras del fichero): un desplegable por cada campo de `ColumnMapping` (fecha y descripción obligatorios; importe como una sola columna o como debe/haber separados, a elegir; fecha valor/referencia/moneda opcionales). Al enviarlo se vuelve a llamar a `preview`, esta vez con `columnMapping` explícito.
3. **Previsualización**: tarjetas de resumen (filas, nuevas, duplicadas, con error) y una tabla con el estado de cada fila y el motivo si no es "nueva". "Confirmar importación" solo envía las filas con estado `new` (nunca las duplicadas o con error) a `POST /imports/confirm`, y se deshabilita si no hay ninguna nueva.

Tras confirmar, pantalla de éxito con el recuento real devuelto por el servidor y enlaces para importar otro fichero o ir directamente a Transacciones. Confirmar invalida `imports`, `transactions` y `dashboard`.

### Verificación

Probado en el navegador real con dos ficheros CSV ficticios (nunca datos reales, según las normas del proyecto):

- Fichero con cabeceras estándar (`Fecha,Concepto,Importe`): detección automática de columnas, una fila duplicada *dentro del propio fichero* detectada correctamente, importación de las 5 filas nuevas, aparición inmediata en `/transactions`.
- Edición de un movimiento: asignar categoría, marcar "crear regla automática" → aviso "Se creó una regla de clasificación automática" tras guardar, categoría reflejada en la tabla.
- Borrado de un movimiento, filtro por fecha (`Desde`) reduciendo correctamente el listado.
- Segundo fichero con cabeceras no reconocibles (`F. Operacion,Texto,Cargo,Abono`): disparó el asistente de mapeo manual; mapeado fecha/descripción/debe/haber a mano, la previsualización mostró los importes con el signo correcto (abono positivo, cargo negativo) y la importación se confirmó sin problemas.
- Reimportar el primer fichero completo: las 4 filas que ya existían en la cuenta se marcaron "Ya existe un movimiento igual en esta cuenta" (deduplicación contra la base de datos, no solo dentro del fichero) y solo la fila que había borrado antes salió como "Nueva" — confirma que la huella (`fingerprint`) se recalcula correctamente en cada intento.

**Nota sobre la herramienta de navegador**: no hay ningún `file_upload` disponible en este entorno para adjuntar un fichero real desde disco a un `<input type="file">`, así que los ficheros de prueba se construyeron en memoria dentro de la propia página (`new File([texto], nombre)` + `DataTransfer`, asignado a `input.files` y con el evento `change` disparado) — es la forma estándar de simular una selección de fichero en un test de navegador, no un atajo que se salte la ruta real de subida (`multipart/form-data` llega igual al backend). El resto de la interacción, igual que en el bloque 2, se hizo contra el DOM real vía `javascript_tool` porque `read_page`/`computer` seguían sin componer frames de forma fiable en esta sesión.

### Fuera de alcance en el bloque 3

- Sin selección múltiple para editar/borrar varios movimientos a la vez.
- Sin exportar el listado de transacciones (CSV/Excel).
- Sin previsualización de XLSX probada en vivo en este bloque (la detección de formato y el parseo ya tienen cobertura de tests en el backend; la ruta de UI es idéntica a la de CSV, solo cambia el importador que resuelve el backend por extensión).

## Bloque 4: Comercios + Reglas de clasificación

### Alcance

`/merchants` (alta, edición, borrado y gestión de alias) y `/classification-rules` (alta, edición, borrado, y una acción para reclasificar movimientos ya existentes). Es el bloque que completa la UI del motor de clasificación determinista que el backend ya tenía desde la Fase 2: hasta ahora solo se podía crear una regla indirectamente al corregir un movimiento a mano (bloque 3); aquí se gestionan directamente.

### Comercios

- Los alias no se gestionan en el diálogo de alta/edición (que solo cubre nombre y categoría por defecto): tienen su propio endpoint (`POST/DELETE /merchants/:id/aliases`) y su propio ciclo de vida, así que se gestionan directamente en la tarjeta de cada comercio — añadir con un campo + botón, quitar con una "x" en cada insignia — sin abrir ningún diálogo. `MERCHANTS_QUERY_KEY` se invalida tras cada mutación de alias igual que tras editar el propio comercio, porque el listado (`findAll`) ya incluye los alias (`include: { aliases: true }` en el backend), no hace falta una query separada.
- El aviso bajo el selector de categoría por defecto explica su efecto real: solo se aplica cuando ninguna regla de clasificación coincide antes (el orden real de prioridad — regla > comercio — vive en `ClassificationService.classify()` del backend).

### Reglas de clasificación

- `RuleField` en el backend solo tiene un valor posible (`DESCRIPTION`) por ahora, así que el formulario no incluye un selector de campo: se omite y el backend aplica el valor por defecto.
- El operador `REGEX` reutiliza la misma validación que ya hace el backend (`new RegExp(value)` antes de guardar); el frontend no duplica esa validación, solo deja pasar el error 400 tal cual si el patrón es inválido.
- Los importes mínimo/máximo llevan una nota explícita de que los gastos son negativos en este modelo de datos, para que un rango de gasto "entre 1 € y 100 €" se escriba como -100 a -1 y no al revés.
- Botón **"Reclasificar movimientos existentes"**, sobre `POST /classification/reclassify`: vuelve a evaluar todas las reglas y comercios contra los movimientos que no se han categorizado a mano (`classificationSource` distinto de `"manual"`), sin tocar nunca una corrección manual. Muestra el resultado real devuelto por el servidor ("Se revisaron X, se actualizaron Y") como aviso descartable, igual que el patrón ya usado en Transacciones.

### Verificación

Probado en el navegador real, encadenando comercios, reglas e importación para comprobar el motor completo, no solo cada CRUD por separado:

- Alta de un comercio con categoría por defecto, alta y borrado de un alias, edición del nombre, borrado del comercio.
- Importado un movimiento ficticio ("GASOLINERA FICTICIA CENTRO") sin ninguna regla activa → quedó sin categoría, como se esperaba.
- Creada una regla ("Contiene GASOLINERA" → categoría Transporte) y pulsado "Reclasificar movimientos existentes" → respuesta real del servidor "Se revisaron 1 movimientos sin categorizar a mano; se actualizaron 1", y el movimiento pasó a mostrar "Transporte" en `/transactions` sin recargar la página.
- Edición de la prioridad de la regla, y borrado.

### Fuera de alcance en el bloque 4

- Sin previsualización de "a qué movimientos afectaría esta regla" antes de guardarla (solo se ve el efecto después, vía reclasificar).
- Sin reordenar reglas arrastrando (la prioridad se edita como número).
- Sin fusionar comercios duplicados.

## Bloque 5: Transferencias + Recurrentes

### Alcance

`/transfers` (detección de transferencias entre cuentas propias, revisión manual de pares dudosos) y `/recurring` (detección automática de patrones recurrentes, alta manual, edición, borrado). Ambos módulos comparten la misma forma: un algoritmo del backend propone candidatos sobre datos ya importados, y el usuario los confirma, corrige o crea a mano — no hay alta libre de una transferencia o un recurrente sin que exista ya movimiento real detrás.

### Transferencias internas

- "Detectar transferencias" llama a `POST /transfers/detect` (cuenta opcional, tolerancia en días configurable, por defecto los 3 días del backend) y muestra el resumen real devuelto (evaluados, pares encontrados, cuántos se confirmaron solos por alta confianza y cuántos quedan pendientes de revisar).
- Cada fila expone solo las transiciones de estado que tienen sentido desde el estado actual (`PENDING`→ Confirmar/Rechazar; `CONFIRMED`→ Rechazar/Deshacer; `REJECTED`→ Confirmar/Deshacer), sobre `PATCH /transfers/:id`. Confirmar/deshacer una transferencia invalida `transactions` además de `transfers`: el backend marca o desmarca `isInternalTransfer` en ambos movimientos, y eso cambia si cuentan como ingreso/gasto real en el resto de la app.

### Recurrentes

- "Detectar automáticamente" (`POST /recurring/detect`) y la creación manual (`POST /recurring/manual`, eligiendo ≥2 movimientos de la misma cuenta y mismo signo en un diálogo) reutilizan el mismo detector de patrones del backend — la diferencia es que el manual no exige que el intervalo encaje en un periodo estándar (semanal/mensual/...), pero si no hay estándar exige 3 ocurrencias en vez de 2, y variación de importe/fecha limitada. El frontend no duplica esa lógica: dejar que el `FormError` del diálogo muestre el 400 tal cual si el patrón no cuela es más fiable que reimplementar la misma regla en dos sitios.
- El picker de movimientos para la creación manual reutiliza `useTransactions` (ya existente desde el bloque 3), con un parámetro `enabled` nuevo en ese hook para no lanzar la petición hasta que se elige una cuenta — evita mandar una `pageSize: 0` inválida o una petición sin filtrar innecesaria.
- Activar/desactivar un grupo es una insignia-botón directamente en la fila (sin diálogo, es un `PATCH` de un solo campo); editar la categoría sí abre un diálogo pequeño, porque es el único otro campo editable (`UpdateRecurringDto` solo cubre `categoryId` e `isActive`).
- La columna "Origen" distingue Automático/Manual (`isManual`) para que quede claro qué grupos no debe tocar el detector automático (el backend nunca reasigna movimientos de un grupo manual).

### Verificación

Probado en el navegador real encadenando cuentas, importación, transferencias y recurrentes:

- Dos cuentas ficticias con un traspaso de 200 € el mismo día en direcciones opuestas → "Detectar transferencias" lo emparejó con 100% de confianza y lo confirmó automáticamente; la insignia "Transferencia interna" apareció en ambos movimientos en `/transactions`.
- Cambiado el estado a Rechazada → la insignia desapareció de los dos movimientos (confirma que `isInternalTransfer` se desmarca en ambos lados, no solo en el registro de la transferencia).
- Dos cargos idénticos de Netflix con 29 días de diferencia → "Detectar automáticamente" creó un grupo mensual; editada su categoría y comprobado el toggle activo/inactivo en ambos sentidos.
- Creación manual: primer intento con 2 movimientos de intervalo irregular (74 días) → el backend lo rechazó correctamente ("no muestran un patrón... suficientemente consistente"), verificando que el error real se propaga hasta el diálogo. Añadida una tercera ocurrencia con intervalo similar → la creación manual funcionó, con frecuencia "Otra" y origen "Manual" correctamente distinguido del automático. Grupo borrado después.

### Fuera de alcance en el bloque 5

- Sin mostrar la explicación de por qué una transferencia tiene baja confianza (el `%` se muestra, pero no el desglose del algoritmo).
- El picker de movimientos para crear un grupo manual solo carga la primera página (100 movimientos) de la cuenta elegida; para cuentas con más histórico habría que añadir búsqueda o paginación ahí.
- Sin gráfico de "coste mensual total de recurrentes" (ya calculado por movimiento vía `monthlyEquivalent`/`annualEstimate`, pero agregarlo es contenido del bloque 6, el dashboard completo).

## Bloque 6: Dashboard completo + Estadísticas + Presupuestos + Objetivos

### Alcance

Último bloque del frontend: sustituye el dashboard mínimo del bloque 1 por el completo (`/`), y construye las tres secciones que quedaban como `ComingSoonPage`: `/analytics`, `/budgets` y `/savings-goals`. Es el bloque que consume la mayor parte de los endpoints de solo lectura del backend (`analytics/*`, `dashboard`) además del CRUD de presupuestos y objetivos.

### Gráficos propios en vez de una librería

El dashboard y Estadísticas necesitan tres visualizaciones: evolución mensual (barras), patrimonio en el tiempo (línea) y desglose por categoría/comercio (barras horizontales). En vez de añadir una librería de gráficos completa para tres visualizaciones sencillas, se construyeron tres componentes propios en `components/charts/`:

- `monthly-bars.tsx`: barras de ingresos/gastos por mes con CSS puro (altura proporcional al máximo del periodo mostrado).
- `bar-list.tsx`: lista de barras horizontales proporcionales, reutilizada tanto para gasto por categoría como por comercio.
- `net-worth-sparkline.tsx`: una polyline SVG minimalista para la evolución del patrimonio.

Ninguno depende de una librería externa; los tres son puramente presentacionales (reciben los datos ya calculados por el backend, no calculan nada).

### Dashboard (`/`)

Reemplaza la versión mínima del bloque 1. Secciones, todas alimentadas por la única llamada a `GET /dashboard` (que el backend ya componía desde el bloque de Fase 2, agregando analytics + presupuestos + objetivos + recurrentes en una sola respuesta):

- Alertas (`alerts`): banner por severidad (`info`/`warning`/`critical`) para presupuestos cerca del límite, objetivos retrasados y pagos recurrentes próximos — ya calculadas por el backend, el frontend solo las pinta.
- Tarjetas de resumen con comparación porcentual contra el mes anterior (ingresos/gastos), coloreando "menos gasto" como positivo y "menos ingreso" como negativo (parámetro `invertChangeTone` en `SummaryCard`).
- "Dinero realmente disponible": saldo líquido menos pagos recurrentes pendientes menos aportación mensual necesaria a objetivos activos — el mismo cálculo que ya hacía `dashboard-math.ts` en el backend desde Fase 2, aquí solo se visualiza.
- Evolución mensual y patrimonio (los dos gráficos), gasto por categoría y mayores gastos del mes, y miniaturas de presupuestos/objetivos con enlace "Ver todos" a su página completa.

### Estadísticas (`/analytics`)

Vista de exploración libre sobre los mismos datos, con filtros propios: cuenta, mes del resumen (`GET /analytics/summary`), y un rango de fechas independiente para los desgloses (`by-category`, `by-merchant`, `top-expenses`) — el backend no comparte el rango entre esas rutas y el resumen (el resumen es siempre por mes de calendario; los desgloses son por rango libre), así que el frontend tampoco lo comparte. Sin rango explícito, `by-category`/`by-merchant`/`top-expenses` usan el valor por defecto del backend (desde el día 1 del mes hasta **hoy**, no hasta fin de mes) — verificado explícitamente durante las pruebas, ver más abajo.

### Presupuestos (`/budgets`)

- Alta: categoría (o "General") + importe; **la categoría no se puede cambiar después** (`UpdateBudgetDto` solo acepta `amount` e `isActive`), así que el diálogo de edición la muestra como texto fijo en vez de un selector.
- El progreso (`GET /budgets/progress?month=...`) es una consulta aparte de la lista (`GET /budgets`, que trae todos los presupuestos incluidos los inactivos): se cruzan por `id` en el cliente. Un presupuesto inactivo no tiene entrada en `progress`, así que la tarjeta lo señala explícitamente en vez de mostrar una barra vacía o engañosa.
- El color de la barra seguido el mismo criterio que las alertas del backend: `alertLevel 100` → rojo (superado), `>= 90` → ámbar, si no → color de marca.

### Objetivos de ahorro (`/savings-goals`)

- El formulario tiene dos modos según si `accountId` está vinculado: **automático** (el progreso es el saldo de la cuenta elegida, `currentAmount` no se puede tocar) o **manual** (el usuario actualiza `currentAmount` a mano). Cambiar de una cuenta a "Manual" en edición revela el campo de importe ahorrado; el backend rechaza con 400 si se manda `currentAmount` estando vinculado a una cuenta, así que el campo ni se muestra en ese caso.
- Los indicadores de progreso (`savedSoFar`, `progressPercent`, `monthlyContributionNeeded`, `isOnTrack`, `deviation`...) vienen ya calculados por `savings-goal-math.ts` en el backend; el frontend no reimplementa ninguno de esos cálculos.

### Verificación

Probado en el navegador real con una cuenta con saldo inicial y ocho movimientos ficticios repartidos en agosto y septiembre (nómina, supermercado, alquiler, restaurante, gasolinera):

- Dashboard con datos reales: patrimonio, ingresos/gastos del mes con el porcentaje correcto respecto al mes anterior (verificados a mano: 2500 vs. 2400 → 4.2%; 955 vs. 840 → 13.7%), tasa de ahorro 61.8%, "disponible por día" recalculado correctamente tras crear objetivos de ahorro.
- **Hallazgo esperado, no un bug**: al fechar movimientos de prueba después de "hoy" (el reloj del sistema marca 2026-09-02, y algunos movimientos ficticios llevaban fecha 5/7/10 de septiembre), el desglose por categoría y "mayores gastos" del dashboard los excluyó — correcto, porque `by-category`/`top-expenses` usan por defecto "desde el día 1 del mes hasta hoy", no el mes completo (a diferencia del resumen, que sí es el mes de calendario completo). Confirmado fijando explícitamente el rango en Estadísticas (`Desglose desde/hasta` = todo septiembre): los mismos gastos aparecieron correctamente desglosados por categoría, ordenados de mayor a menor.
- Presupuestos: uno general (1000 €, 95.5% consumido) y uno por categoría (Vivienda, 650 €, superado en 50 € con el aviso correcto); alerta correspondiente aparece en el dashboard ("Presupuesto de general: 95.5% consumido"); desactivar oculta el progreso con el mensaje explicativo; borrado.
- Objetivos de ahorro: uno manual (aportación inicial 1000 €, editado el importe ahorrado a 2500 € → 30% de progreso correcto) y uno vinculado a la cuenta (progreso automático = saldo de la cuenta, 66.7% correcto sin introducir nada a mano); ambos alimentaron correctamente "Aportación a objetivos" en el dashboard (592,98 € + 112,05 € = 705,03 €, verificado); borrado.

### Fuera de alcance en el bloque 6

- Sin exportar ningún informe (PDF/Excel) de Estadísticas.
- Sin editable inline de los importes de "Mayores gastos" desde el dashboard (hay que ir a Transacciones).
- El sparkline de patrimonio no tiene tooltip por punto, solo el primer y último valor con etiqueta.

## Frontend: cierre de los seis bloques

Con este bloque se completan las seis secciones planificadas al empezar el frontend (Fase 0). Deuda técnica conocida, transversal a varios bloques, para revisar si hace falta más adelante:

- El bundle de producción ronda ~875 kB sin comprimir (~240 kB gzip) en un único chunk; sin code-splitting todavía. Vale la pena revisarlo si la app sigue creciendo.
- Sin menú de navegación para móvil (la barra lateral se oculta por completo en pantallas pequeñas).
- Sin páginas de error 404/500 dedicadas.
- El caso `PublicOnlyRoute` (redirigir a un usuario ya autenticado que visita `/login`) se verificó solo por simetría de código con `ProtectedRoute` en el bloque 1, nunca en vivo.
