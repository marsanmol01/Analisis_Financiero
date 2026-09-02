import { generate } from "otplib";
import { buildOtpAuthUrl, generateTotpSecret, verifyTotpCode } from "./totp";

describe("totp", () => {
  it("genera un secreto en base32 distinto cada vez", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(a).not.toBe(b);
  });

  it("construye una URL otpauth:// con el emisor y el email del usuario", () => {
    const url = buildOtpAuthUrl("persona@example.com", "JBSWY3DPEHPK3PXP");
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain("Plataforma%20Financiera");
    expect(url).toContain("persona%40example.com");
  });

  it("verifica como válido un código generado en ese instante con el mismo secreto", async () => {
    const secret = generateTotpSecret();
    const code = await generate({ secret });
    await expect(verifyTotpCode(secret, code)).resolves.toBe(true);
  });

  it("rechaza un código que no corresponde al secreto", async () => {
    const secret = generateTotpSecret();
    const otherSecret = generateTotpSecret();
    const codeForOtherSecret = await generate({ secret: otherSecret });
    await expect(verifyTotpCode(secret, codeForOtherSecret)).resolves.toBe(false);
  });

  it("rechaza un código con formato inválido sin lanzar", async () => {
    const secret = generateTotpSecret();
    await expect(verifyTotpCode(secret, "no-es-un-codigo")).resolves.toBe(false);
  });
});
