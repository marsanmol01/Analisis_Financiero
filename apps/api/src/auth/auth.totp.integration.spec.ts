// Test de integracion real (no mockeado) contra la base de datos de desarrollo/test.
// Cubre el ciclo de vida completo del segundo factor: activarlo (con y sin el codigo
// correcto, emitiendo codigos de recuperacion), el login en dos pasos que pasa a exigir a
// partir de ahi (con codigo TOTP o de recuperacion), el contador de fuerza bruta compartido,
// regenerar codigos de recuperacion, y la desactivacion (que exige contraseña Y codigo).
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { generate } from "otplib";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../crypto/encryption.service";
import { AuthService } from "./auth.service";

describe("AuthService — verificación en dos pasos (integración)", () => {
  let prisma: PrismaService;
  let service: AuthService;
  let user: { id: string; email: string };
  let recoveryCodes: string[] = [];
  const PASSWORD = "correct-horse-battery-staple";

  beforeAll(async () => {
    const config = {
      get: (key: string) => process.env[key],
      getOrThrow: (key: string) => process.env[key],
    } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    const encryption = new EncryptionService(config);
    service = new AuthService(prisma, config, encryption);

    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    user = await prisma.user.create({
      data: { email: `totp-integration-${Date.now()}@example.test`, passwordHash },
    });
  });

  afterAll(async () => {
    await prisma.recoveryCode.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.onModuleDestroy();
  });

  it("el secreto se guarda cifrado en base de datos, nunca en claro", async () => {
    const setup = await service.setupTotp(user.id);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.totpSecretEncrypted).not.toBeNull();
    expect(stored.totpSecretEncrypted).not.toContain(setup.secret);
    expect(stored.totpSecretEncrypted!.split(".")).toHaveLength(3); // iv.authTag.ciphertext
    expect(stored.totpEnabled).toBe(false); // pendiente de confirmar
  });

  it("enableTotp rechaza un código incorrecto y no activa el 2FA", async () => {
    await expect(service.enableTotp(user.id, "000000")).rejects.toThrow();
    const stillDisabled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stillDisabled.totpEnabled).toBe(false);
  });

  it("enableTotp activa el 2FA con el código real y emite 10 códigos de recuperación distintos, guardados hasheados", async () => {
    const setup = await service.setupTotp(user.id);
    const code = await generate({ secret: setup.secret });

    const result = await service.enableTotp(user.id, code);

    expect(result.user.totpEnabled).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(new Set(result.recoveryCodes).size).toBe(10);
    recoveryCodes = result.recoveryCodes;

    const storedCodes = await prisma.recoveryCode.findMany({ where: { userId: user.id } });
    expect(storedCodes).toHaveLength(10);
    for (const stored of storedCodes) {
      expect(recoveryCodes).not.toContain(stored.codeHash); // nunca en claro en la fila
    }
  });

  it("attemptLogin ya no abre sesión directamente: exige el segundo factor", async () => {
    const outcome = await service.attemptLogin(user.email, PASSWORD);
    expect(outcome).toEqual({ status: "totp_required", userId: user.id });
  });

  it("verifyTotpLogin incrementa el contador de fallos con un código incorrecto (mismo contador que la contraseña)", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const outcome = await service.verifyTotpLogin(user.id, "000000");

    expect(outcome).toEqual({ status: "invalid_credentials" });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLoginCount).toBe(before.failedLoginCount + 1);
  });

  it("verifyTotpLogin completa el login con el código real y resetea el contador de fallos", async () => {
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const secret = new EncryptionService({
      get: () => process.env.ENCRYPTION_KEY,
    } as unknown as ConfigService).decrypt(stored.totpSecretEncrypted!);
    const code = await generate({ secret });

    const outcome = await service.verifyTotpLogin(user.id, code);

    expect(outcome).toEqual({
      status: "success",
      user: { id: user.id, email: user.email, totpEnabled: true, monthlySavingsTarget: null },
    });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLoginCount).toBe(0);
  });

  it("un código de recuperación real también completa el login y avisa de cuántos quedan sin usar", async () => {
    await service.attemptLogin(user.email, PASSWORD);

    const outcome = await service.verifyTotpLogin(user.id, recoveryCodes[0]);

    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") throw new Error("unreachable");
    expect(outcome.recoveryCodeWarning).toContain("9 código");
  });

  it("un código de recuperación ya usado no puede reutilizarse en un login posterior", async () => {
    await service.attemptLogin(user.email, PASSWORD);

    const outcome = await service.verifyTotpLogin(user.id, recoveryCodes[0]);

    expect(outcome).toEqual({ status: "invalid_credentials" });
  });

  it("countRemainingRecoveryCodes refleja el código ya consumido", async () => {
    await expect(service.countRemainingRecoveryCodes(user.id)).resolves.toBe(9);
  });

  it("regenerateRecoveryCodes exige la contraseña correcta e invalida el lote anterior entero, incluidos los códigos nunca usados", async () => {
    await expect(service.regenerateRecoveryCodes(user.id, "contraseña-incorrecta")).rejects.toThrow();

    const neverUsedOldCode = recoveryCodes[1];
    const fresh = await service.regenerateRecoveryCodes(user.id, PASSWORD);

    expect(fresh).toHaveLength(10);
    expect(new Set(fresh).size).toBe(10);
    recoveryCodes = fresh;
    await expect(service.countRemainingRecoveryCodes(user.id)).resolves.toBe(10);

    await service.attemptLogin(user.email, PASSWORD);
    const outcome = await service.verifyTotpLogin(user.id, neverUsedOldCode);
    expect(outcome).toEqual({ status: "invalid_credentials" });
  });

  it("disableTotp exige la contraseña correcta, no basta con el código", async () => {
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const secret = new EncryptionService({
      get: () => process.env.ENCRYPTION_KEY,
    } as unknown as ConfigService).decrypt(stored.totpSecretEncrypted!);
    const code = await generate({ secret });

    await expect(service.disableTotp(user.id, "contraseña-incorrecta", code)).rejects.toThrow();
    const stillEnabled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stillEnabled.totpEnabled).toBe(true);
  });

  it("disableTotp con contraseña correcta y un código de recuperación (no el TOTP) desactiva el 2FA, borra el secreto y descarta los códigos", async () => {
    const result = await service.disableTotp(user.id, PASSWORD, recoveryCodes[2]);

    expect(result.totpEnabled).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.totpEnabled).toBe(false);
    expect(after.totpSecretEncrypted).toBeNull();

    const remainingCodes = await prisma.recoveryCode.findMany({ where: { userId: user.id } });
    expect(remainingCodes).toHaveLength(0);
  });

  it("tras desactivarlo, el login vuelve a completarse solo con la contraseña", async () => {
    const outcome = await service.attemptLogin(user.email, PASSWORD);
    expect(outcome).toEqual({
      status: "success",
      user: { id: user.id, email: user.email, totpEnabled: false, monthlySavingsTarget: null },
    });
  });
});
