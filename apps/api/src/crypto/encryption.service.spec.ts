import { ConfigService } from "@nestjs/config";
import { EncryptionService } from "./encryption.service";

function createConfig(value?: string): ConfigService {
  return { get: () => value } as unknown as ConfigService;
}

const VALID_KEY = Buffer.alloc(32, 7).toString("base64");

describe("EncryptionService", () => {
  it("descifra exactamente el mismo texto que se cifró", () => {
    const service = new EncryptionService(createConfig(VALID_KEY));
    const ciphertext = service.encrypt("secreto-totp-de-prueba");
    expect(service.decrypt(ciphertext)).toBe("secreto-totp-de-prueba");
  });

  it("produce un IV distinto (y por tanto un payload distinto) cada vez, incluso para el mismo texto", () => {
    const service = new EncryptionService(createConfig(VALID_KEY));
    const a = service.encrypt("mismo-texto");
    const b = service.encrypt("mismo-texto");
    expect(a).not.toBe(b);
  });

  it("rechaza descifrar si el payload fue manipulado (autenticacion GCM)", () => {
    const service = new EncryptionService(createConfig(VALID_KEY));
    const ciphertext = service.encrypt("secreto-totp-de-prueba");
    const [iv, authTag, data] = ciphertext.split(".");
    const tampered = [iv, authTag, Buffer.from("otra-cosa").toString("base64")].join(".");
    void data;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it("rechaza descifrar con una clave distinta a la que cifró", () => {
    const service = new EncryptionService(createConfig(VALID_KEY));
    const otherKey = Buffer.alloc(32, 9).toString("base64");
    const otherService = new EncryptionService(createConfig(otherKey));
    const ciphertext = service.encrypt("secreto-totp-de-prueba");
    expect(() => otherService.decrypt(ciphertext)).toThrow();
  });

  it("falla al construirse si ENCRYPTION_KEY no está definido", () => {
    expect(() => new EncryptionService(createConfig(undefined))).toThrow();
  });

  it("falla al construirse si ENCRYPTION_KEY conserva el valor de ejemplo", () => {
    expect(() => new EncryptionService(createConfig("changeme-generate-a-32-byte-base64-key"))).toThrow();
  });

  it("falla al construirse si la clave no decodifica a 32 bytes", () => {
    const shortKey = Buffer.alloc(16, 1).toString("base64");
    expect(() => new EncryptionService(createConfig(shortKey))).toThrow();
  });
});
