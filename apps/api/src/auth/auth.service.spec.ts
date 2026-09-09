import { ConfigService } from "@nestjs/config";
import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { generate } from "otplib";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../crypto/encryption.service";
import { generateTotpSecret } from "./totp";
import { generateRecoveryCodes, hashRecoveryCode } from "./recovery-codes";

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  recoveryCode: {
    findMany: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    count: jest.Mock;
  };
};

function createMockPrisma(): MockPrisma {
  return {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    recoveryCode: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 10 }),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

function createConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    AUTH_MAX_FAILED_ATTEMPTS: "3",
    AUTH_LOCKOUT_MINUTES: "15",
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

// Identidad: as pruebas de AuthService no necesitan volver a probar que el cifrado en si
// mismo es correcto (eso ya lo cubre encryption.service.spec.ts), solo que AuthService lo
// invoca en el momento adecuado. Con esta identidad, `totpSecretEncrypted` guardado/leido es
// literalmente el secreto en claro, lo que permite generar codigos TOTP reales en el test.
function createIdentityEncryption(): EncryptionService {
  return {
    encrypt: jest.fn((value: string) => value),
    decrypt: jest.fn((value: string) => value),
  } as unknown as EncryptionService;
}

describe("AuthService", () => {
  let prisma: MockPrisma;
  let encryption: EncryptionService;
  let service: AuthService;

  beforeEach(() => {
    prisma = createMockPrisma();
    encryption = createIdentityEncryption();
    service = new AuthService(prisma as unknown as PrismaService, createConfig(), encryption);
  });

  describe("register", () => {
    it("hashea la contraseña y crea el usuario cuando el email no existe", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: "user-1",
          email: data.email,
          passwordHash: data.passwordHash,
          totpEnabled: false,
        }),
      );

      const result = await service.register({ email: "a@example.com", password: "correct-horse-battery" });

      expect(result).toEqual({ id: "user-1", email: "a@example.com", totpEnabled: false });
      const createdArgs = prisma.user.create.mock.calls[0][0];
      expect(createdArgs.data.passwordHash).not.toEqual("correct-horse-battery");
      expect(await argon2.verify(createdArgs.data.passwordHash, "correct-horse-battery")).toBe(true);
    });

    it("rechaza el registro si el email ya existe", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

      await expect(
        service.register({ email: "a@example.com", password: "correct-horse-battery" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe("attemptLogin", () => {
    it("devuelve success con credenciales correctas y resetea el contador de fallos", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        failedLoginCount: 2,
        lockedUntil: null,
        totpEnabled: false,
      });

      const outcome = await service.attemptLogin("a@example.com", "correct-horse-battery");

      expect(outcome).toEqual({ status: "success", user: { id: "user-1", email: "a@example.com", totpEnabled: false } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    });

    it("devuelve totp_required con contraseña correcta si el usuario tiene 2FA activado, sin resetear el contador", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        totpEnabled: true,
        totpSecretEncrypted: "un-secreto",
      });

      const outcome = await service.attemptLogin("a@example.com", "correct-horse-battery");

      expect(outcome).toEqual({ status: "totp_required", userId: "user-1" });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("devuelve invalid_credentials si el usuario no existe, sin filtrar esa información", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const outcome = await service.attemptLogin("no-existe@example.com", "cualquier-cosa");

      expect(outcome).toEqual({ status: "invalid_credentials" });
    });

    it("devuelve invalid_credentials con contraseña incorrecta e incrementa el contador", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        totpEnabled: false,
      });

      const outcome = await service.attemptLogin("a@example.com", "contraseña-incorrecta");

      expect(outcome).toEqual({ status: "invalid_credentials" });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginCount: 1, lockedUntil: null },
      });
    });

    it("bloquea la cuenta al alcanzar el máximo de intentos fallidos configurado", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        failedLoginCount: 2, // límite configurado en el mock es 3
        lockedUntil: null,
        totpEnabled: false,
      });

      const outcome = await service.attemptLogin("a@example.com", "contraseña-incorrecta");

      expect(outcome.status).toBe("locked");
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.failedLoginCount).toBe(3);
      expect(updateArgs.data.lockedUntil).toBeInstanceOf(Date);
    });

    it("rechaza el login mientras la cuenta está bloqueada, incluso con la contraseña correcta", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        failedLoginCount: 3,
        lockedUntil: new Date(Date.now() + 10 * 60_000),
        totpEnabled: false,
      });

      const outcome = await service.attemptLogin("a@example.com", "correct-horse-battery");

      expect(outcome.status).toBe("locked");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("verifyTotpLogin", () => {
    it("completa el login con un código válido y resetea el contador de fallos", async () => {
      const secret = generateTotpSecret();
      const code = await generate({ secret });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpEnabled: true,
        totpSecretEncrypted: secret,
        failedLoginCount: 1,
        lockedUntil: null,
      });

      const outcome = await service.verifyTotpLogin("user-1", code);

      expect(outcome).toEqual({ status: "success", user: { id: "user-1", email: "a@example.com", totpEnabled: true } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    });

    it("incrementa el contador de fallos con un código incorrecto, igual que una contraseña incorrecta", async () => {
      const secret = generateTotpSecret();
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpEnabled: true,
        totpSecretEncrypted: secret,
        failedLoginCount: 0,
        lockedUntil: null,
      });

      const outcome = await service.verifyTotpLogin("user-1", "000000");

      expect(outcome).toEqual({ status: "invalid_credentials" });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginCount: 1, lockedUntil: null },
      });
    });

    it("rechaza si el usuario no tiene 2FA activado", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpEnabled: false,
        totpSecretEncrypted: null,
      });

      const outcome = await service.verifyTotpLogin("user-1", "123456");

      expect(outcome).toEqual({ status: "invalid_credentials" });
    });

    it("completa el login con un código de recuperación válido, lo marca gastado y avisa de cuántos quedan", async () => {
      const [recoveryCode] = generateRecoveryCodes(1);
      const codeHash = await hashRecoveryCode(recoveryCode);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpEnabled: true,
        totpSecretEncrypted: generateTotpSecret(),
        failedLoginCount: 0,
        lockedUntil: null,
      });
      prisma.recoveryCode.findMany.mockResolvedValue([{ id: "rc-1", codeHash }]);
      prisma.recoveryCode.count.mockResolvedValue(4);

      const outcome = await service.verifyTotpLogin("user-1", recoveryCode);

      expect(outcome.status).toBe("success");
      if (outcome.status !== "success") throw new Error("unreachable");
      expect(outcome.recoveryCodeWarning).toContain("4 códigos");
      expect(prisma.recoveryCode.update).toHaveBeenCalledWith({
        where: { id: "rc-1" },
        data: { usedAt: expect.any(Date) },
      });
    });

    it("un código de recuperación ya usado (o inexistente) no completa el login", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpEnabled: true,
        totpSecretEncrypted: generateTotpSecret(),
        failedLoginCount: 0,
        lockedUntil: null,
      });
      prisma.recoveryCode.findMany.mockResolvedValue([]); // ya gastado: no aparece entre los "usedAt: null"

      const outcome = await service.verifyTotpLogin("user-1", "AAAAA-BBBBB");

      expect(outcome).toEqual({ status: "invalid_credentials" });
      expect(prisma.recoveryCode.update).not.toHaveBeenCalled();
    });
  });

  describe("setupTotp / enableTotp / disableTotp", () => {
    it("setupTotp genera un secreto, lo cifra y devuelve un código QR", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "user-1", email: "a@example.com" });
      prisma.user.update.mockResolvedValue({});

      const result = await service.setupTotp("user-1");

      expect(result.secret).toMatch(/^[A-Z2-7]+$/);
      expect(result.otpauthUrl).toContain("a%40example.com");
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { totpSecretEncrypted: result.secret }, // cifrado identidad en el test
      });
    });

    it("enableTotp activa el 2FA con un código válido y emite 10 códigos de recuperación distintos", async () => {
      const secret = generateTotpSecret();
      const code = await generate({ secret });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpSecretEncrypted: secret,
      });
      prisma.user.update.mockResolvedValue({ id: "user-1", email: "a@example.com", totpEnabled: true });

      const result = await service.enableTotp("user-1", code);

      expect(result.user.totpEnabled).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { totpEnabled: true } });
      expect(result.recoveryCodes).toHaveLength(10);
      expect(new Set(result.recoveryCodes).size).toBe(10);
      // El lote anterior (si lo hubiera) se sustituye entero antes de emitir el nuevo.
      expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
      expect(prisma.recoveryCode.createMany).toHaveBeenCalled();
    });

    it("enableTotp rechaza un código incorrecto sin activar el 2FA", async () => {
      const secret = generateTotpSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpSecretEncrypted: secret,
      });

      await expect(service.enableTotp("user-1", "000000")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.recoveryCode.createMany).not.toHaveBeenCalled();
    });

    it("enableTotp rechaza si no se ha llamado antes a setupTotp", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpSecretEncrypted: null,
      });

      await expect(service.enableTotp("user-1", "123456")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("disableTotp exige contraseña Y código correctos, borra el secreto y descarta los códigos de recuperación", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      const secret = generateTotpSecret();
      const code = await generate({ secret });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        totpEnabled: true,
        totpSecretEncrypted: secret,
      });
      prisma.user.update.mockResolvedValue({ id: "user-1", email: "a@example.com", totpEnabled: false });

      const result = await service.disableTotp("user-1", "correct-horse-battery", code);

      expect(result.totpEnabled).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { totpEnabled: false, totpSecretEncrypted: null },
      });
      expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });

    it("disableTotp también acepta un código de recuperación válido en vez del código TOTP", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      const [recoveryCode] = generateRecoveryCodes(1);
      const codeHash = await hashRecoveryCode(recoveryCode);
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        totpEnabled: true,
        totpSecretEncrypted: generateTotpSecret(),
      });
      prisma.recoveryCode.findMany.mockResolvedValue([{ id: "rc-1", codeHash }]);
      prisma.user.update.mockResolvedValue({ id: "user-1", email: "a@example.com", totpEnabled: false });

      const result = await service.disableTotp("user-1", "correct-horse-battery", recoveryCode);

      expect(result.totpEnabled).toBe(false);
    });

    it("disableTotp rechaza con la contraseña incorrecta, sin llegar a comprobar el código", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      const secret = generateTotpSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        totpEnabled: true,
        totpSecretEncrypted: secret,
      });

      await expect(service.disableTotp("user-1", "contraseña-incorrecta", "123456")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("disableTotp rechaza con código incorrecto aunque la contraseña sea correcta", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      const secret = generateTotpSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        passwordHash,
        totpEnabled: true,
        totpSecretEncrypted: secret,
      });

      await expect(service.disableTotp("user-1", "correct-horse-battery", "000000")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("regenerateRecoveryCodes / countRemainingRecoveryCodes", () => {
    it("regenera un lote nuevo de 10 códigos con la contraseña correcta", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        passwordHash,
        totpEnabled: true,
      });

      const codes = await service.regenerateRecoveryCodes("user-1", "correct-horse-battery");

      expect(codes).toHaveLength(10);
      expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
      expect(prisma.recoveryCode.createMany).toHaveBeenCalled();
    });

    it("rechaza regenerar con la contraseña incorrecta", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "user-1", passwordHash, totpEnabled: true });

      await expect(service.regenerateRecoveryCodes("user-1", "contraseña-incorrecta")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.recoveryCode.createMany).not.toHaveBeenCalled();
    });

    it("rechaza regenerar si el 2FA no está activado", async () => {
      const passwordHash = await argon2.hash("correct-horse-battery", { type: argon2.argon2id });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "user-1", passwordHash, totpEnabled: false });

      await expect(service.regenerateRecoveryCodes("user-1", "correct-horse-battery")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("cuenta solo los códigos sin usar", async () => {
      prisma.recoveryCode.count.mockResolvedValue(7);

      await expect(service.countRemainingRecoveryCodes("user-1")).resolves.toBe(7);
      expect(prisma.recoveryCode.count).toHaveBeenCalledWith({ where: { userId: "user-1", usedAt: null } });
    });
  });
});
