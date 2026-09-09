// Codigos de recuperacion de un solo uso para cuando se pierde el dispositivo con la app de
// autenticacion. Se generan en lotes, se muestran una unica vez en claro y se guardan
// hasheados (igual que una contraseña) — nunca se pueden volver a leer, solo verificar.
import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";

// Sin caracteres ambiguos al leerlos a mano: sin 0/O, 1/I/L.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_CHARS = 10; // antes de insertar el guion separador
export const RECOVERY_CODE_LENGTH = CODE_CHARS;
const DEFAULT_COUNT = 10;

function randomCode(): string {
  const bytes = randomBytes(CODE_CHARS);
  let raw = "";
  for (let i = 0; i < CODE_CHARS; i++) {
    raw += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function generateRecoveryCodes(count = DEFAULT_COUNT): string[] {
  return Array.from({ length: count }, randomCode);
}

// Quita espacios/guiones y pasa a mayusculas: el usuario puede copiar el codigo con o sin el
// guion separador, o con espacios si lo transcribe a mano, y debe verificar igual.
export function normalizeRecoveryCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isRecoveryCodeFormat(input: string): boolean {
  return normalizeRecoveryCode(input).length === RECOVERY_CODE_LENGTH;
}

export function hashRecoveryCode(code: string): Promise<string> {
  return argon2.hash(normalizeRecoveryCode(code), { type: argon2.argon2id });
}

export function verifyRecoveryCodeHash(hash: string, code: string): Promise<boolean> {
  return argon2.verify(hash, normalizeRecoveryCode(code));
}
