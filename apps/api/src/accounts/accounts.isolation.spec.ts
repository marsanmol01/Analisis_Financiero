// Test de integracion real (no mockeado) contra la base de datos de desarrollo/test
// levantada con `docker compose up -d postgres`. Verifica el requisito de seguridad
// mas importante de este bloque: un usuario nunca puede leer, listar, modificar ni
// borrar cuentas de otro usuario.
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "./accounts.service";

describe("AccountsService (aislamiento entre usuarios)", () => {
  let prisma: PrismaService;
  let service: AccountsService;
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    service = new AccountsService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({
      data: { email: `isolation-a-${suffix}@example.test`, passwordHash },
    });
    userB = await prisma.user.create({
      data: { email: `isolation-b-${suffix}@example.test`, passwordHash },
    });
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  it("un usuario no puede leer la cuenta de otro usuario", async () => {
    const account = await service.create(userA.id, {
      name: "Cuenta A",
      type: "CHECKING",
      currency: "EUR",
    });

    await expect(service.findOne(userB.id, account.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne(userA.id, account.id)).resolves.toMatchObject({ id: account.id });
  });

  it("un usuario no puede modificar la cuenta de otro usuario", async () => {
    const account = await service.create(userA.id, {
      name: "Cuenta A2",
      type: "SAVINGS",
      currency: "EUR",
    });

    await expect(
      service.update(userB.id, account.id, { name: "Nombre inyectado por otro usuario" }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const unchanged = await service.findOne(userA.id, account.id);
    expect(unchanged.name).toBe("Cuenta A2");
  });

  it("un usuario no puede borrar la cuenta de otro usuario", async () => {
    const account = await service.create(userA.id, {
      name: "Cuenta A3",
      type: "CASH",
      currency: "EUR",
    });

    await expect(service.remove(userB.id, account.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne(userA.id, account.id)).resolves.toMatchObject({ id: account.id });
  });

  it("el listado de un usuario no incluye cuentas de otro usuario", async () => {
    await service.create(userA.id, { name: "Cuenta exclusiva de A", type: "CARD", currency: "EUR" });

    const listB = await service.findAll(userB.id);
    expect(listB.find((account) => account.name === "Cuenta exclusiva de A")).toBeUndefined();
  });

  it("una cuenta borrada (soft delete) desaparece del listado de su propio dueño", async () => {
    const account = await service.create(userA.id, {
      name: "Cuenta a borrar",
      type: "DIGITAL",
      currency: "EUR",
    });

    await service.remove(userA.id, account.id);

    const listA = await service.findAll(userA.id);
    expect(listA.find((a) => a.id === account.id)).toBeUndefined();
    await expect(service.findOne(userA.id, account.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
