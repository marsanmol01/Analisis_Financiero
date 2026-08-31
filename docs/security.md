# Seguridad — estado tras Fase 1 / Bloque "Accounts + Categories"

## Autenticación

- Contraseñas: hash con **Argon2id** (`argon2` npm package), nunca texto plano.
- Sesión: `express-session` con almacén en PostgreSQL (`connect-pg-simple`), cookie `pf.sid` con `httpOnly`, `sameSite=lax`, `secure` en producción.
- Regeneración de sesión en cada login (previene fijación de sesión).
- Bloqueo por fuerza bruta: tras `AUTH_MAX_FAILED_ATTEMPTS` (por defecto 5) intentos fallidos, la cuenta queda bloqueada `AUTH_LOCKOUT_MINUTES` (por defecto 15) minutos. El contador se resetea en login correcto.
- El login no distingue en su respuesta entre "email no existe" y "contraseña incorrecta" (mismo mensaje, coste temporal similar) para no filtrar qué emails están registrados.
- 2FA (TOTP): campos `totp_secret_encrypted` / `totp_enabled` ya están en el modelo de datos; la implementación de los endpoints se hace en un paso posterior.

## CSRF

Mitigación ligera aplicada a los endpoints mutantes de `auth` (`register`, `login`, `logout`): se exige la cabecera `X-Requested-With: XMLHttpRequest`. Una petición cross-site "simple" (envío de formulario, `<img>`, etc.) no puede fijar esa cabecera sin disparar un preflight CORS, y CORS solo permite el origen configurado en `WEB_ORIGIN`.

Ahora también aplicado a los endpoints mutantes de `accounts` y `categories`. Sigue siendo por-ruta en vez de global; cuando el número de módulos con mutaciones sea mayor, conviene revisar si merece la pena moverlo a guard global con lista de exclusión para `GET`.

## Rate limiting

- Global: 60 peticiones/minuto por IP (`ThrottlerModule`, aplicado como guard global).
- `POST /auth/register`: 5/minuto.
- `POST /auth/login`: 10/minuto (adicional al bloqueo por cuenta).

## Cabeceras HTTP

`helmet()` aplicado globalmente (CSP por defecto, `X-Content-Type-Options`, etc.). Se revisará y ajustará una CSP específica cuando el frontend sirva assets propios en producción.

## Aislamiento entre usuarios

`AccountsService` y `CategoriesService` filtran **todas** las queries por `userId` (nunca solo por `id`). Acceder, modificar o borrar un recurso de otro usuario devuelve `404` (no `403`), para no confirmar que el recurso existe. Cubierto por [`accounts.isolation.spec.ts`](../apps/api/src/accounts/accounts.isolation.spec.ts), que es un test de **integración real** contra la base de datos de desarrollo (no mockeado): crea dos usuarios reales y verifica que ninguno puede leer/listar/modificar/borrar recursos del otro. Requiere `docker compose up -d postgres` corriendo localmente.

Las categorías del sistema (`isSystem=true`) son visibles para todos los usuarios pero de solo lectura: intentar modificarlas da `403` (aquí sí, porque el usuario ya sabe que existen — las ve en su propio listado).

## Cuentas: no se guardan identificadores bancarios completos

El campo `ibanMask` de `Account` está validado en la capa de API (`IsMaskedAccountIdentifier`): rechaza con `400` cualquier valor que tenga forma de IBAN completo sin enmascarar. Solo se acepta un identificador parcial/enmascarado (ej. `ES91 **** **** **** 1234`).

## Auditoría

`audit_logs` registra: `REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGIN_LOCKED`, `LOGOUT`, `ACCOUNT_CREATED`, `ACCOUNT_UPDATED`, `ACCOUNT_DELETED`, con `user_id` (cuando aplica), IP y metadata mínima (nunca contraseñas ni tokens, ni el contenido de la cuenta — solo su id). `AuditService.record()` es el único punto de escritura. Las mutaciones de categorías no están en la lista de eventos auditables definida originalmente y no se auditan en este bloque.

## Secretos

`SESSION_SECRET` es obligatorio; el arranque de la API falla explícitamente si no está definido o si conserva el valor de ejemplo de `.env.example`.

## Pendiente explícito (deuda conocida, no bloqueante para este paso)

- Cifrado a nivel de aplicación: no hay todavía ningún campo que lo requiera (no se almacena nada suficientemente sensible más allá del hash de contraseña). Se documentará aquí en cuanto se introduzca el primer campo cifrado (candidato: `totp_secret_encrypted` cuando se implemente 2FA).
- CSP específica de producción.
- Mutaciones de categorías sin auditar (ver arriba).
- Borrado de categorías es físico (`delete`), no soft-delete; a diferencia de cuentas y (más adelante) transacciones, no hay razón todavía para conservar el historial de una categoría borrada. Se revisará si en Fase 2 las reglas de clasificación referencian categorías por id de forma que un borrado deba bloquearse o degradar en cascada.
