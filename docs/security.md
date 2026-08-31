# Seguridad — estado tras Fase 1 / Paso 1

## Autenticación

- Contraseñas: hash con **Argon2id** (`argon2` npm package), nunca texto plano.
- Sesión: `express-session` con almacén en PostgreSQL (`connect-pg-simple`), cookie `pf.sid` con `httpOnly`, `sameSite=lax`, `secure` en producción.
- Regeneración de sesión en cada login (previene fijación de sesión).
- Bloqueo por fuerza bruta: tras `AUTH_MAX_FAILED_ATTEMPTS` (por defecto 5) intentos fallidos, la cuenta queda bloqueada `AUTH_LOCKOUT_MINUTES` (por defecto 15) minutos. El contador se resetea en login correcto.
- El login no distingue en su respuesta entre "email no existe" y "contraseña incorrecta" (mismo mensaje, coste temporal similar) para no filtrar qué emails están registrados.
- 2FA (TOTP): campos `totp_secret_encrypted` / `totp_enabled` ya están en el modelo de datos; la implementación de los endpoints se hace en un paso posterior.

## CSRF

Mitigación ligera aplicada a los endpoints mutantes de `auth` (`register`, `login`, `logout`): se exige la cabecera `X-Requested-With: XMLHttpRequest`. Una petición cross-site "simple" (envío de formulario, `<img>`, etc.) no puede fijar esa cabecera sin disparar un preflight CORS, y CORS solo permite el origen configurado en `WEB_ORIGIN`.

**Pendiente**: cuando existan más endpoints que cambian estado (cuentas, transacciones, reglas...), este guard (`CsrfHeaderGuard`) debe aplicarse globalmente o sustituirse por un patrón de token de doble envío si se detectan casos que lo requieran (por ejemplo, exports con efectos secundarios).

## Rate limiting

- Global: 60 peticiones/minuto por IP (`ThrottlerModule`, aplicado como guard global).
- `POST /auth/register`: 5/minuto.
- `POST /auth/login`: 10/minuto (adicional al bloqueo por cuenta).

## Cabeceras HTTP

`helmet()` aplicado globalmente (CSP por defecto, `X-Content-Type-Options`, etc.). Se revisará y ajustará una CSP específica cuando el frontend sirva assets propios en producción.

## Aislamiento entre usuarios

Todavía no hay ningún recurso de datos (cuentas, transacciones) protegido por `user_id`, por lo que no existen aún tests de aislamiento cross-usuario reales. Se añaden en el siguiente bloque de Fase 1, junto con `AccountsModule`, y son un requisito bloqueante antes de dar por cerrado ese bloque.

## Auditoría

`audit_logs` registra: `REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGIN_LOCKED`, `LOGOUT`, con `user_id` (cuando aplica), IP y metadata mínima (nunca contraseñas ni tokens). `AuditService.record()` es el único punto de escritura.

## Secretos

`SESSION_SECRET` es obligatorio; el arranque de la API falla explícitamente si no está definido o si conserva el valor de ejemplo de `.env.example`.

## Pendiente explícito (deuda conocida, no bloqueante para este paso)

- Cifrado a nivel de aplicación: no hay todavía ningún campo que lo requiera (no se almacena nada suficientemente sensible más allá del hash de contraseña). Se documentará aquí en cuanto se introduzca el primer campo cifrado (candidato: `totp_secret_encrypted` cuando se implemente 2FA).
- CSP específica de producción.
- Tests de aislamiento multiusuario (ver arriba).
