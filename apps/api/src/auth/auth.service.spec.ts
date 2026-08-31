import { ConfigService } from "@nestjs/config";
import { ConflictException } from "@nestjs/common";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function createMockPrisma(): MockPrisma {
  return {
    user: {
      findUnique: jest.fn(),
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

describe("AuthService", () => {
  let prisma: MockPrisma;
  let service: AuthService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AuthService(prisma as unknown as PrismaService, createConfig());
  });

  describe("register", () => {
    it("hashea la contraseña y crea el usuario cuando el email no existe", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "user-1", email: data.email, passwordHash: data.passwordHash }),
      );

      const result = await service.register({ email: "a@example.com", password: "correct-horse-battery" });

      expect(result).toEqual({ id: "user-1", email: "a@example.com" });
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
      });

      const outcome = await service.attemptLogin("a@example.com", "correct-horse-battery");

      expect(outcome).toEqual({ status: "success", user: { id: "user-1", email: "a@example.com" } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
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
      });

      const outcome = await service.attemptLogin("a@example.com", "correct-horse-battery");

      expect(outcome.status).toBe("locked");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
