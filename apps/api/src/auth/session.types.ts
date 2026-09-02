import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    // Contraseña ya verificada, a la espera del segundo factor (login en dos pasos). Nunca
    // coexiste con `userId`: mientras esto está presente, la sesión NO está autenticada todavía
    // (SessionAuthGuard sigue exigiendo `userId`).
    pendingTotpUserId?: string;
  }
}
