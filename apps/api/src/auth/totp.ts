// Envoltorio fino sobre otplib: aisla la libreria concreta del resto del modulo de auth y
// deja un unico sitio donde ajustar parametros (tolerancia de reloj, emisor del QR...).
import { generateSecret, generateURI, verify } from "otplib";

const ISSUER = "Plataforma Financiera";

// 30s de tolerancia a cada lado del paso actual: admite el desfase de reloj tipico entre el
// movil y el servidor sin abrir una ventana de aceptacion demasiado ancha.
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildOtpAuthUrl(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  } catch {
    // Un codigo con formato inesperado no debe tumbar la peticion, solo contar como invalido.
    return false;
  }
}
