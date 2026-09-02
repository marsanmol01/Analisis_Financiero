// Test de integracion real (no mockeado) contra la base de datos de desarrollo/test.
// Cubre el ciclo de vida completo del segundo factor: activarlo (con y sin el codigo
// correcto), el login en dos pasos que pasa a exigir a partir de ahi, el contador de fuerza
// bruta compartido con la contraseña, y la desactivacion (que exige contraseña Y codigo).
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

  it("enableTotp activa el 2FA con el código real generado a partir del secreto configurado", async () => {
    const setup = await service.setupTotp(user.id);
    const code = await generate({ secret: setup.secret });

    const result = await service.enableTotp(user.id, code);

    expect(result.totpEnabled).toBe(true);
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

    expect(outcome).toEqual({ status: "success", user: { id: user.id, email: user.email, totpEnabled: true } });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.failedLoginCount).toBe(0);
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

  it("disableTotp con contraseña y código correctos desactiva el 2FA y borra el secreto", async () => {
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const secret = new EncryptionService({
      get: () => process.env.ENCRYPTION_KEY,
    } as unknown as ConfigService).decrypt(stored.totpSecretEncrypted!);
    const code = await generate({ secret });

    const result = await service.disableTotp(user.id, PASSWORD, code);

    expect(result.totpEnabled).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.totpEnabled).toBe(false);
    expect(after.totpSecretEncrypted).toBeNull();
  });

  it("tras desactivarlo, el login vuelve a completarse solo con la contraseña", async () => {
    const outcome = await service.attemptLogin(user.email, PASSWORD);
    expect(outcome).toEqual({ status: "success", user: { id: user.id, email: user.email, totpEnabled: false } });
  });
});
