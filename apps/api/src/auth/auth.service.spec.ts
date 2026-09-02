import { ConfigService } from "@nestjs/config";
import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { generate } from "otplib";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../crypto/encryption.service";
import { generateTotpSecret } from "./totp";

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
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

    it("enableTotp activa el 2FA con un código válido para el secreto pendiente", async () => {
      const secret = generateTotpSecret();
      const code = await generate({ secret });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpSecretEncrypted: secret,
      });
      prisma.user.update.mockResolvedValue({ id: "user-1", email: "a@example.com", totpEnabled: true });

      const result = await service.enableTotp("user-1", code);

      expect(result.totpEnabled).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { totpEnabled: true } });
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
    });

    it("enableTotp rechaza si no se ha llamado antes a setupTotp", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "a@example.com",
        totpSecretEncrypted: null,
      });

      await expect(service.enableTotp("user-1", "123456")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("disableTotp exige contraseña Y código correctos, y borra el secreto", async () => {
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
});
