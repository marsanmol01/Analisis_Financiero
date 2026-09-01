# Seguridad — estado tras Fase 3 / Bloque "Objetivos de ahorro"

## Autenticación

- Contraseñas: hash con **Argon2id** (`argon2` npm package), nunca texto plano.
- Sesión: `express-session` con almacén en PostgreSQL (`connect-pg-simple`), cookie `pf.sid` con `httpOnly`, `sameSite=lax`, `secure` en producción.
- Regeneración de sesión en cada login (previene fijación de sesión).
- Bloqueo por fuerza bruta: tras `AUTH_MAX_FAILED_ATTEMPTS` (por defecto 5) intentos fallidos, la cuenta queda bloqueada `AUTH_LOCKOUT_MINUTES` (por defecto 15) minutos. El contador se resetea en login correcto.
- El login no distingue en su respuesta entre "email no existe" y "contraseña incorrecta" (mismo mensaje, coste temporal similar) para no filtrar qué emails están registrados.
- 2FA (TOTP): campos `totp_secret_encrypted` / `totp_enabled` ya están en el modelo de datos; la implementación de los endpoints se hace en un paso posterior.

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

## Auditoría

`audit_logs` registra: `REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGIN_LOCKED`, `LOGOUT`, `ACCOUNT_CREATED`, `ACCOUNT_UPDATED`, `ACCOUNT_DELETED`, `IMPORT_CREATED`, `TRANSACTION_UPDATED`, `TRANSACTION_DELETED`, `RULE_CREATED`, `RULE_UPDATED`, `RULE_DELETED`, `TRANSFER_STATUS_CHANGED`, con `user_id` (cuando aplica), IP y metadata mínima (nunca contraseñas ni tokens, ni el contenido de la cuenta/transacción/regla — solo ids y contadores). `AuditService.record()` es el único punto de escritura. `RULE_CREATED` se audita **dentro del servicio** (`ClassificationRulesService`), no en el controller, precisamente porque se puede crear una regla desde dos caminos distintos (`POST /classification-rules` y la corrección de una transacción con `createRule: true`) y ambos deben quedar cubiertos igual. Las mutaciones de categorías y de comercios/alias siguen sin auditarse (no estaban en la lista de eventos original).

## Secretos

`SESSION_SECRET` es obligatorio; el arranque de la API falla explícitamente si no está definido o si conserva el valor de ejemplo de `.env.example`.

## Pendiente explícito (deuda conocida, no bloqueante para este paso)

- Cifrado a nivel de aplicación: no hay todavía ningún campo que lo requiera (no se almacena nada suficientemente sensible más allá del hash de contraseña). Se documentará aquí en cuanto se introduzca el primer campo cifrado (candidato: `totp_secret_encrypted` cuando se implemente 2FA).
- CSP específica de producción.
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
