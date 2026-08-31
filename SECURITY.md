# Política de seguridad

Este proyecto maneja datos financieros personales. Reglas obligatorias para cualquier cambio:

- Nunca subir al repositorio: credenciales bancarias, PIN, códigos SMS/OTP, claves de firma, números completos de tarjeta o cuenta, extractos bancarios reales, backups.
- `.env` nunca se sube a Git. Usa `.env.example` como plantilla y genera `SESSION_SECRET` con `openssl rand -base64 48`.
- Los fixtures y datos de desarrollo deben ser siempre ficticios (ver `fixtures/`).
- Las contraseñas se hashean con Argon2id; nunca se almacenan en texto plano ni se registran en logs.
- Los eventos de auditoría (`audit_logs`) no deben contener contraseñas, tokens, secretos ni datos completos de tarjeta/cuenta.
- Toda query a la base de datos debe pasar por Prisma (parametrizada), nunca SQL concatenado.

Detalle completo del modelo de amenazas y controles en [`docs/security.md`](docs/security.md).

## Reportar un problema de seguridad

Este es un proyecto personal sin usuarios externos por ahora. Si detectas un problema, documéntalo directamente como incidencia interna antes de desplegar a producción.
