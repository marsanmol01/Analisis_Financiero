# Seguridad — estado tras 2FA (TOTP)

## Autenticación

- Contraseñas: hash con **Argon2id** (`argon2` npm package), nunca texto plano.
- Sesión: `express-session` con almacén en PostgreSQL (`connect-pg-simple`), cookie `pf.sid` con `httpOnly`, `sameSite=lax`, `secure` en producción.
- Regeneración de sesión en cada login (previene fijación de sesión) — y también al pasar de "pendiente de segundo factor" a autenticado, ver más abajo.
- Bloqueo por fuerza bruta: tras `AUTH_MAX_FAILED_ATTEMPTS` (por defecto 5) intentos fallidos, la cuenta queda bloqueada `AUTH_LOCKOUT_MINUTES` (por defecto 15) minutos. El contador se resetea solo cuando el login se completa de verdad (ver 2FA).
- El login no distingue en su respuesta entre "email no existe" y "contraseña incorrecta" (mismo mensaje, coste temporal similar) para no filtrar qué emails están registrados.

## Verificación en dos pasos (2FA / TOTP)

- Librería `otplib` (TOTP estándar, compatible con Google Authenticator, Authy, 1Password...), 6 dígitos, 30s de tolerancia a cada lado del paso actual para absorber el desfase de reloj típico entre el móvil y el servidor.
- El secreto se guarda **cifrado en reposo** (nunca en claro) con `EncryptionService` (AES-256-GCM, autenticado). La clave vive en `ENCRYPTION_KEY` (32 bytes en base64); el arranque de la API falla explícitamente si no está definida o conserva el valor de ejemplo — mismo patrón que ya existía para `SESSION_SECRET`. Es el primer campo cifrado de la aplicación (`docs/security.md` lo dejaba como pendiente explícito).
- **Activación**: `POST /auth/2fa/setup` genera y guarda un secreto nuevo (todavía sin activar) y devuelve el código QR (`qrcode`, generado en el servidor) más el secreto en texto para introducir a mano; `POST /auth/2fa/enable` lo confirma con un código real. Repetir `setup` sustituye cualquier secreto pendiente sin confirmar.
- **Login en dos pasos**: si el usuario tiene el 2FA activo, la contraseña correcta ya no abre sesión — `POST /auth/login` devuelve `{status: "totp_required"}` y dentro de la sesión (regenerada) se guarda `pendingTotpUserId`, **nunca** `userId`: `SessionAuthGuard` sigue rechazando la petición mientras solo exista ese estado intermedio (verificado explícitamente: `GET /auth/me` sigue devolviendo 401 en ese punto). `POST /auth/2fa/verify-login` completa el login con el código.
- **El contador de fuerza bruta es el mismo para contraseña y código**: un código TOTP incorrecto incrementa `failedLoginCount` exactamente igual que una contraseña incorrecta, y puede bloquear la cuenta. Solo se resetea cuando el login se completa del todo (con el segundo factor si aplica) — acertar la contraseña pero fallar el código repetidamente sigue contando como intentos fallidos sobre la cuenta.
- **Desactivación**: `POST /auth/2fa/disable` exige contraseña **y** código correctos a la vez (no basta con robar la sesión activa ni con solo la contraseña); borra el secreto cifrado y todos los códigos de recuperación al desactivar.
- Nuevos eventos de auditoría `TOTP_ENABLED` / `TOTP_DISABLED`.

### Códigos de recuperación

- Un lote de 10 códigos (formato `XXXXX-XXXXX`, alfabeto sin caracteres ambiguos — sin `0`/`O`, `1`/`I`/`L`) se genera automáticamente al activar el 2FA (`POST /auth/2fa/enable`) y se devuelve **una única vez** en la respuesta; el cliente debe guardarlos, el servidor no vuelve a poder mostrarlos. Se pueden regenerar en cualquier momento (`POST /auth/2fa/recovery-codes/regenerate`, exige contraseña), lo que invalida entero el lote anterior — incluidos los códigos nunca usados.
- Se guardan **hasheados con Argon2id** (`recovery_codes.code_hash`), igual que una contraseña: nunca en claro, ni siquiera cifrados de forma reversible, porque la aplicación no necesita volver a leerlos, solo verificarlos.
- De un solo uso: al verificarse correctamente se marca `used_at` y no vuelve a aceptarse.
- **Se aceptan como alternativa al código TOTP tanto para completar el login (`POST /auth/2fa/verify-login`) como para desactivar el 2FA (`POST /auth/2fa/disable`)**: si se ha perdido el dispositivo con la app de autenticación, un código de recuperación debe bastar también para desactivarlo (siempre junto con la contraseña). El formato del valor recibido decide el camino: 6 dígitos se intenta como TOTP, cualquier otra cosa como código de recuperación — nunca se prueban los dos caminos para el mismo valor.
- Al usar un código de recuperación para entrar, la respuesta incluye un aviso legible (`recoveryCodeWarning`) con cuántos códigos quedan sin usar, y se audita como `RECOVERY_CODE_USED` además de `LOGIN_SUCCESS`.
- El contador de fuerza bruta compartido (ver arriba) cubre igual un código de recuperación incorrecto: no es una vía para evitar el bloqueo por intentos fallidos.
- Cubierto por [`auth.service.spec.ts`](../apps/api/src/auth/auth.service.spec.ts) (unitario, incluye el nuevo estado `totp_required` y el contador de fallos compartido), [`totp.spec.ts`](../apps/api/src/auth/totp.spec.ts) (generación/verificación de códigos reales), [`recovery-codes.spec.ts`](../apps/api/src/auth/recovery-codes.spec.ts) (formato, normalización, hash/verificación), [`encryption.service.spec.ts`](../apps/api/src/crypto/encryption.service.spec.ts) (cifrado/descifrado, manipulación detectada, clave incorrecta) y [`auth.totp.integration.spec.ts`](../apps/api/src/auth/auth.totp.integration.spec.ts), que es integración real contra la base de datos: comprueba que el secreto se guarda cifrado (nunca aparece en claro en la fila), el ciclo completo activar (con emisión de códigos) → login en dos pasos (con TOTP y con código de recuperación) → regenerar códigos (invalidando el lote viejo entero) → desactivar con un código de recuperación → y que tras desactivarlo el login vuelve a completarse solo con la contraseña.
- Verificado además a nivel HTTP real (con cookies de sesión reales, cabecera CSRF, y JSON) en el navegador/API en vivo durante el desarrollo: registro, login sin 2FA, activación con QR, login exigiendo el segundo factor, código incorrecto rechazado, código correcto completando el login, desactivación rechazada con contraseña incorrecta y con código incorrecto por separado, desactivación correcta, y vuelta al login directo.

## CSRF

Mitigación ligera aplicada a los endpoints mutantes de `auth` (`register`, `login`, `logout`): se exige la cabecera `X-Requested-With: XMLHttpRequest`. Una petición cross-site "simple" (envío de formulario, `<img>`, etc.) no puede fijar esa cabecera sin disparar un preflight CORS, y CORS solo permite el origen configurado en `WEB_ORIGIN`.

Ahora también aplicado a los endpoints mutantes de `accounts`, `categories`, `transactions`, `imports` (incluida la subida de fichero en `/imports/preview`, que es precisamente el vector clásico de CSRF vía formulario), `merchants`, `classification-rules`, `transfers` (`POST /transfers/detect`, `PATCH /transfers/:id`), `recurring` (`POST /recurring/detect`, `POST /recurring/manual`, `PATCH /recurring/:id`, `DELETE /recurring/:id`), `budgets` (`POST`/`PATCH`/`DELETE /budgets`) y `savings-goals` (`POST`/`PATCH`/`DELETE /savings-goals`). Sigue siendo por-ruta en vez de global; cuando el número de módulos con mutaciones sea mayor, conviene revisar si merece la pena moverlo a guard global con lista de exclusión para `GET`.

## Rate limiting

- Global: 60 peticiones/minuto por IP (`ThrottlerModule`, aplicado como guard global).
- `POST /auth/register`: 5/minuto.
- `POST /auth/login`: 10/minuto (adicional al bloqueo por cuenta).

## Cabeceras HTTP

`helmet()` aplicado globalmente (CSP por defecto, `X-Content-Type-Options`, etc.). Se revisará y ajustará una CSP específica cuando el frontend sirva assets propios en producción.

## Aislamiento entre usuarios

`AccountsService` y `CategoriesService` filtran **todas** las queries por `userId` (nunca solo por `id`). Acceder, modificar o borrar un recurso de otro usuario devuelve `404` (no `403`), para no confirmar que el recurso existe. Cubierto por [`accounts.isolation.spec.ts`](../apps/api/src/accounts/accounts.isolation.spec.ts), que es un test de **integración real** contra la base de datos de desarrollo (no mockeado): crea dos usuarios reales y verifica que ninguno puede leer/listar/modificar/borrar recursos del otro. Requiere `docker compose up -d postgres` corriendo localmente.

Las categorías del sistema (`isSystem=true`) son visibles para todos los usuarios pero de solo lectura: intentar modificarlas da `403` (aquí sí, porque el usuario ya sabe que existen — las ve en su propio listado).

`TransactionsService` e `ImportsService` siguen el mismo patrón: las transacciones se filtran uniendo por la cuenta del usuario (`account: { userId }`), y una importación siempre verifica primero que la cuenta destino pertenece al usuario (`AccountsService.findOne`) antes de tocar nada. Cubierto por [`transactions.isolation.spec.ts`](../apps/api/src/transactions/transactions.isolation.spec.ts) y por los tests de aislamiento en [`imports.integration.spec.ts`](../apps/api/src/imports/imports.integration.spec.ts).

`MerchantsService` y `ClassificationRulesService` siguen el mismo patrón (`userId` en cada query, `404` en cruce entre usuarios), cubierto por [`merchants.isolation.spec.ts`](../apps/api/src/merchants/merchants.isolation.spec.ts) y [`classification-rules.isolation.spec.ts`](../apps/api/src/classification-rules/classification-rules.isolation.spec.ts). `ClassificationService.reclassify()` está scopeado por `userId` incluso cuando se le pasa un `accountId`: si ese `accountId` perteneciera a otro usuario, la condición combinada `account: { userId, id: accountId }` no encuentra nada (no hace falta una comprobación de propiedad aparte, es correcto por construcción de la query).

`TransfersService.detect()` obtiene los dos pools de candidatos (salientes/entrantes) siempre filtrados por `account: { userId }`: es estructuralmente imposible que proponga un match entre transacciones de dos usuarios distintos, aunque coincidan importe y fecha exactos — verificado explícitamente en [`transfers.isolation.spec.ts`](../apps/api/src/transfers/transfers.isolation.spec.ts).

`RecurringService` sigue el mismo patrón: agrupación y `findOne`/`update`/`remove` siempre `where: { userId }` o `account: { userId }`; verificado en [`recurring.isolation.spec.ts`](../apps/api/src/recurring/recurring.isolation.spec.ts) incluyendo que no se agrupan transacciones de dos usuarios distintos aunque coincidan comercio e importe.

`AnalyticsService` (solo lectura) sigue el mismo patrón en las seis consultas que expone; verificado en [`analytics.isolation.spec.ts`](../apps/api/src/analytics/analytics.isolation.spec.ts) que un ingreso de 50.000 € en la cuenta de otro usuario no aparece ni en el resumen ni en el patrimonio del usuario que consulta.

`BudgetsService` sigue el mismo patrón; verificado en [`budgets.isolation.spec.ts`](../apps/api/src/budgets/budgets.isolation.spec.ts) que un gasto de 50.000 € de otro usuario no se cuela en el progreso del presupuesto general de quien consulta.

`SavingsGoalsService` sigue el mismo patrón; además, en modo automático (objetivo vinculado a una cuenta), la comprobación de que esa cuenta pertenece al usuario ocurre al crear/editar el vínculo, no solo al leer el progreso. Verificado en [`savings-goals.isolation.spec.ts`](../apps/api/src/savings-goals/savings-goals.isolation.spec.ts).

`DashboardService` no añade ninguna consulta propia a la base de datos: compone exclusivamente las de los servicios anteriores, así que hereda su aislamiento. Verificado igualmente en [`dashboard.isolation.spec.ts`](../apps/api/src/dashboard/dashboard.isolation.spec.ts).

## Cuentas: no se guardan identificadores bancarios completos

El campo `ibanMask` de `Account` está validado en la capa de API (`IsMaskedAccountIdentifier`): rechaza con `400` cualquier valor que tenga forma de IBAN completo sin enmascarar. Solo se acepta un identificador parcial/enmascarado (ej. `ES91 **** **** **** 1234`).

## Importación de ficheros

Ver [`docs/import-system.md`](import-system.md) para el detalle completo (huella/duplicados, parseo tolerante, límites). Puntos de seguridad específicos: límite de 15 MB y 20.000 filas por fichero (evita agotamiento de memoria), ningún contenido de celda se ejecuta o interpreta (sin `eval`), y la huella de cada fila se **recalcula siempre en el servidor** en `/imports/confirm` — nunca se confía en la que devolvió el preview al cliente, para que un cliente modificado no pueda forzar la re-importación de un duplicado.

## Motor de clasificación

Ver [`docs/classification-engine.md`](classification-engine.md). Punto de seguridad relevante: una regla con `operator: REGEX` se valida al crearla/editarla (`new RegExp(value)` en un `try/catch`, `400` si no compila) y además se evalúa siempre dentro de un `try/catch` en tiempo de ejecución — una regex que fallara igualmente ahí (por ejemplo por un cambio de motor en el futuro) no clasifica esa fila en vez de tumbar la importación completa.

## Transferencias internas

Ver [`docs/internal-transfers.md`](internal-transfers.md). El flag `isInternalTransfer` de una transacción solo se activa mientras su `InternalTransfer` está `CONFIRMED`; `PENDING`/`REJECTED` no la excluyen de ingresos/gastos. `detect()` es idempotente: una transacción con cualquier `InternalTransfer` asociado (incluidas las rechazadas) no vuelve a proponerse.

## Gastos recurrentes

Ver [`docs/recurring-detection.md`](recurring-detection.md). Sin superficie de seguridad nueva relevante más allá del aislamiento por `userId` ya mencionado: no ejecuta nada dinámico, no toca `isIncome`/`isExpense`/`isInternalTransfer`, y un grupo manual queda exento de la detección automática para que esta nunca le arrebate transacciones.

## Motor de estadísticas

Ver [`docs/analytics-engine.md`](analytics-engine.md). Módulo enteramente de solo lectura: sin guard CSRF, sin auditoría (no hay nada que auditar en una consulta). Punto de seguridad relevante: **todas** las agregaciones de ingresos/gastos excluyen explícitamente `isInternalTransfer: true` en cada query — verificado como el propio caso de test exigido en los requisitos ("una transferencia interna no suma gasto ni ingreso").

## Presupuestos

Ver [`docs/budgets.md`](budgets.md). Sin superficie de seguridad nueva más allá del aislamiento por `userId`: es un módulo de configuración (importes de referencia), no cambia clasificación financiera ni flags de ninguna transacción.

## Objetivos de ahorro

Ver [`docs/savings-goals.md`](savings-goals.md). Sin superficie de seguridad nueva más allá del aislamiento por `userId`. Punto de diseño relevante para integridad de datos: en modo automático (vinculado a una cuenta), el campo `currentAmount` no se puede editar a mano — se rechaza explícitamente con `400` — para que nunca quede desincronizado del saldo real de la cuenta, que es la única fuente de verdad en ese modo.

## Dashboard

Ver [`docs/dashboard.md`](dashboard.md). Sin superficie de seguridad nueva: solo lectura, sin CSRF, sin auditoría, compone datos ya expuestos individualmente por otros módulos. Introduce `BalanceSnapshot`, capturado automáticamente por `AccountsService` (nunca escrito desde otro sitio) al crear una cuenta o cambiar su saldo — es lo que permite reconstruir honestamente la evolución del patrimonio sin inventar histórico hacia atrás.

## Auditoría

`audit_logs` registra: `REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGIN_LOCKED`, `LOGOUT`, `ACCOUNT_CREATED`, `ACCOUNT_UPDATED`, `ACCOUNT_DELETED`, `IMPORT_CREATED`, `TRANSACTION_UPDATED`, `TRANSACTION_DELETED`, `RULE_CREATED`, `RULE_UPDATED`, `RULE_DELETED`, `TRANSFER_STATUS_CHANGED`, `TOTP_ENABLED`, `TOTP_DISABLED`, `RECOVERY_CODES_GENERATED`, `RECOVERY_CODE_USED`, con `user_id` (cuando aplica), IP y metadata mínima (nunca contraseñas ni tokens, ni el contenido de la cuenta/transacción/regla — solo ids y contadores). `AuditService.record()` es el único punto de escritura. `RULE_CREATED` se audita **dentro del servicio** (`ClassificationRulesService`), no en el controller, precisamente porque se puede crear una regla desde dos caminos distintos (`POST /classification-rules` y la corrección de una transacción con `createRule: true`) y ambos deben quedar cubiertos igual. Las mutaciones de categorías y de comercios/alias siguen sin auditarse (no estaban en la lista de eventos original).

## Secretos

`SESSION_SECRET` y `ENCRYPTION_KEY` son obligatorios; el arranque de la API falla explícitamente si alguno no está definido o conserva el valor de ejemplo de `.env.example`.

## Pendiente explícito (deuda conocida, no bloqueante para este paso)

- CSP específica de producción.
- 2FA sin opción de "recordar este dispositivo": cada login pide el código, siempre, sin excepción de confianza por dispositivo/tiempo.
- Los códigos de recuperación no tienen su propio límite de intentos independiente: comparten el contador de fuerza bruta general de la cuenta (ver arriba), que ya protege contra probarlos al azar, pero no hay una alerta específica de "alguien está agotando tus códigos de recuperación".
- Mutaciones de categorías sin auditar (ver arriba).
- Borrado de categorías es físico (`delete`), no soft-delete; a diferencia de cuentas y transacciones, no hay razón todavía para conservar el historial de una categoría borrada. Se revisará si en Fase 2 las reglas de clasificación referencian categorías por id de forma que un borrado deba bloquearse o degradar en cascada.
- Sanitización de inyección de fórmulas CSV/Excel (celdas que empiezan por `=`, `+`, `-`, `@`): no se implementa todavía porque no hay ninguna vía de exportación/reapertura en Excel — se abordará en la fase de exportación (sección 15 de los requisitos), donde sí es un riesgo real.
- No hay todavía CLI/UI para que el usuario suministre un `columnMapping` manual cuando la autodetección de columnas falla (`needs_mapping`); el backend ya lo soporta, falta la parte de frontend.
- Mutaciones de comercios/alias sin auditar (no estaban en la lista de eventos original y su impacto es menor que una regla, que sí afecta la clasificación automática directamente).
- `reclassify` recorre las transacciones candidatas con un `update` por fila (no en batch); a escala de uso personal (cientos/pocos miles de movimientos) no es un problema, pero si se usa sobre históricos muy grandes convendría paralelizar o usar una única query masiva.
- Detección de transferencias sin tolerancia de importe (para comisiones de red, por ejemplo): exige coincidencia exacta del importe absoluto. Ver [`docs/internal-transfers.md`](internal-transfers.md) para la justificación.
- La ventana de tolerancia en días de `detect()` se pasa por petición, no hay todavía una preferencia persistida por usuario.
- Grupos recurrentes sin auditoría dedicada (ver [`docs/recurring-detection.md`](recurring-detection.md) para la justificación).
- Sin desactivación automática de un grupo recurrente cuyo patrón deja de cumplirse (p. ej. suscripción cancelada); persiste hasta que el usuario lo desactive o borre a mano.
- Patrimonio calculado sobre `Account.balance` (saldo manual/último conocido), no derivado del historial de transacciones importadas — ver [`docs/analytics-engine.md`](analytics-engine.md) para la justificación.
- Distinción activo/pasivo solo por `AccountType === LOAN`; no contempla, por ejemplo, una tarjeta de crédito con saldo pendiente como pasivo.
- Sin comparación interanual todavía en el motor de estadísticas; se añadirá si hace falta al construir el dashboard.
- Presupuestos sin auditoría dedicada (ver [`docs/budgets.md`](budgets.md)).
- Sin presupuestos por cuenta ni con periodo distinto de mensual.
- Objetivos de ahorro sin auditoría dedicada (ver [`docs/savings-goals.md`](savings-goals.md)).
- Objetivos de ahorro sin historial de aportaciones individuales; el modo manual solo guarda el importe acumulado actual.
- Los cálculos de meses en objetivos de ahorro usan una duración media (365,25/12 días), no aritmética de calendario exacta — margen de hasta ~3 días por mes, aceptable para una cifra orientativa.
- Dashboard sin auditoría (solo lectura). Las alertas se recalculan en cada petición, no se persisten ni se pueden marcar como leídas/descartadas.
- "Saldo líquido disponible" incluye por decisión explícita `CHECKING`/`SAVINGS`/`CASH`/`DIGITAL`/`CARD` y excluye `INVESTMENT`/`DEPOSIT`/`LOAN` — ver [`docs/dashboard.md`](dashboard.md) para la justificación completa.
- `getNetWorthEvolution` solo tiene datos desde que existe al menos una `BalanceSnapshot`; para un usuario o cuenta nuevos, los meses anteriores a su creación aparecen a 0€ en vez de con un valor estimado hacia atrás.
