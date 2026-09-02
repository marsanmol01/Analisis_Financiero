import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

// Cifrado simetrico en reposo para datos que no pueden guardarse en claro (hoy: el secreto TOTP)
// pero que, a diferencia de una contraseña, la aplicacion SI necesita poder leer de vuelta.
// AES-256-GCM: autenticado (detecta manipulacion, no solo confidencialidad).
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>("ENCRYPTION_KEY");
    if (!raw || raw === "changeme-generate-a-32-byte-base64-key") {
      throw new Error(
        "ENCRYPTION_KEY no esta configurado o usa el valor de ejemplo. Genera uno con: openssl rand -base64 32",
      );
    }

    const key = Buffer.from(raw, "base64");
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `ENCRYPTION_KEY debe decodificar a ${KEY_LENGTH_BYTES} bytes (AES-256). Genera uno con: openssl rand -base64 32`,
      );
    }
    this.key = key;
  }

  // Formato: "<iv-b64>.<authTag-b64>.<ciphertext-b64>". Un IV aleatorio distinto en cada
  // llamada, aunque se cifre el mismo texto dos veces (nunca reutilizar IV con GCM).
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(".");
  }

  decrypt(payload: string): string {
    const parts = payload.split(".");
    if (parts.length !== 3) {
      throw new Error("Payload cifrado con formato inválido");
    }
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }
}
