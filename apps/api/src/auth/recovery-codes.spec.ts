import {
  RECOVERY_CODE_LENGTH,
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecoveryCodeFormat,
  normalizeRecoveryCode,
  verifyRecoveryCodeHash,
} from "./recovery-codes";

describe("recovery-codes", () => {
  it("genera el número de códigos pedido, todos distintos y con el formato XXXXX-XXXXX", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
  });

  it("normaliza quitando guiones/espacios y pasando a mayúsculas", () => {
    expect(normalizeRecoveryCode("ab3de-fg7h9")).toBe("AB3DEFG7H9");
    expect(normalizeRecoveryCode("  AB3DE FG7H9  ")).toBe("AB3DEFG7H9");
  });

  it("isRecoveryCodeFormat distingue un código de recuperación de un código TOTP de 6 dígitos", () => {
    const [code] = generateRecoveryCodes(1);
    expect(isRecoveryCodeFormat(code)).toBe(true);
    expect(isRecoveryCodeFormat("123456")).toBe(false);
  });

  it("un código se verifica contra su propio hash, con o sin el guion", async () => {
    const [code] = generateRecoveryCodes(1);
    const hash = await hashRecoveryCode(code);
    await expect(verifyRecoveryCodeHash(hash, code)).resolves.toBe(true);
    await expect(verifyRecoveryCodeHash(hash, code.replace("-", "").toLowerCase())).resolves.toBe(true);
  });

  it("un código no coincide con el hash de otro código distinto", async () => {
    const [codeA, codeB] = generateRecoveryCodes(2);
    const hashA = await hashRecoveryCode(codeA);
    await expect(verifyRecoveryCodeHash(hashA, codeB)).resolves.toBe(false);
  });

  it("RECOVERY_CODE_LENGTH coincide con la longitud normalizada real de un código generado", () => {
    const [code] = generateRecoveryCodes(1);
    expect(normalizeRecoveryCode(code)).toHaveLength(RECOVERY_CODE_LENGTH);
  });
});
