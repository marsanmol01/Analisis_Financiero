import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { SavingsGoalsService } from "./savings-goals.service";

describe("SavingsGoalsService (integracion real: modo automatico/manual, aislamiento, validaciones)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let service: SavingsGoalsService;
  let userA: { id: string };
  let userB: { id: string };
  let savingsAccount: { id: string };

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    accountsService = new AccountsService(prisma);
    service = new SavingsGoalsService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `goals-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `goals-b-${suffix}@example.test`, passwordHash } });
    savingsAccount = await accountsService.create(userA.id, {
      name: "Fondo de emergencia",
      type: "SAVINGS",
      currency: "EUR",
      balance: 12500,
    });
  });

  afterAll(async () => {
    await prisma.savingsGoal.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  it("rechaza un objetivo cuyo importe objetivo no es mayor que el inicial", async () => {
    await expect(
      service.create(userA.id, { name: "Objetivo imposible", targetAmount: 100, initialAmount: 100, targetDate: "2030-01-01" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza una fecha límite anterior o igual a la fecha inicial", async () => {
    await expect(
      service.create(userA.id, {
        name: "Fecha invalida",
        targetAmount: 1000,
        targetDate: "2020-01-01", // en el pasado respecto a "ahora" (fecha inicial por defecto)
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("modo automático: el progreso es el saldo de la cuenta vinculada, no un importe manual", async () => {
    const goal = await service.create(userA.id, {
      name: "Fondo de emergencia",
      targetAmount: 15000,
      initialAmount: 10000,
      targetDate: "2030-01-01",
      accountId: savingsAccount.id,
    });

    expect(goal.progress.savedSoFar).toBeCloseTo(2500, 0); // 12500 (saldo real) - 10000 inicial

    // Si el saldo de la cuenta cambia, el progreso se refleja automaticamente sin tocar el objetivo.
    await prisma.account.update({ where: { id: savingsAccount.id }, data: { balance: 14000 } });
    const refreshed = await service.findOne(userA.id, goal.id);
    expect(refreshed.progress.savedSoFar).toBeCloseTo(4000, 0);
  });

  it("rechaza fijar currentAmount a mano en un objetivo vinculado a una cuenta", async () => {
    const goal = await service.create(userA.id, {
      name: "Vinculado",
      targetAmount: 5000,
      targetDate: "2030-01-01",
      accountId: savingsAccount.id,
    });

    await expect(service.update(userA.id, goal.id, { currentAmount: 999 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("modo manual: el progreso es currentAmount y se actualiza a mano", async () => {
    const goal = await service.create(userA.id, {
      name: "Viaje a Tailandia",
      targetAmount: 3000,
      targetDate: "2030-01-01",
    });

    expect(goal.progress.savedSoFar).toBe(0);

    const updated = await service.update(userA.id, goal.id, { currentAmount: 500 });
    expect(updated.progress.savedSoFar).toBe(500);
  });

  it("desvincular una cuenta (accountId: null) permite volver a fijar currentAmount a mano", async () => {
    const goal = await service.create(userA.id, {
      name: "Se desvincula despues",
      targetAmount: 5000,
      targetDate: "2030-01-01",
      accountId: savingsAccount.id,
    });

    const updated = await service.update(userA.id, goal.id, { accountId: null, currentAmount: 200 });
    expect(updated.accountId).toBeNull();
    expect(updated.progress.savedSoFar).toBe(200);
  });

  it("rechaza una cuenta que no pertenece al usuario", async () => {
    const accountB = await accountsService.create(userB.id, { name: "Cuenta de B", type: "SAVINGS", currency: "EUR" });
    await expect(
      service.create(userA.id, { name: "Con cuenta ajena", targetAmount: 1000, targetDate: "2030-01-01", accountId: accountB.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await prisma.account.delete({ where: { id: accountB.id } });
  });

  it("un usuario no puede leer, editar ni borrar el objetivo de otro usuario", async () => {
    const goal = await service.create(userA.id, { name: "Privado de A", targetAmount: 1000, targetDate: "2030-01-01" });

    await expect(service.findOne(userB.id, goal.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(userB.id, goal.id, { name: "hackeado" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(userB.id, goal.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("el listado de un usuario no incluye objetivos de otro usuario", async () => {
    await service.create(userB.id, { name: "Objetivo exclusivo de B", targetAmount: 1000, targetDate: "2030-01-01" });
    const listA = await service.findAll(userA.id);
    expect(listA.find((g) => g.name === "Objetivo exclusivo de B")).toBeUndefined();
  });
});
