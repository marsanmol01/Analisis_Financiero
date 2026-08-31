// Test de integracion real. Cubre dos casos explicitamente requeridos:
//  - un usuario no puede acceder/editar/borrar transacciones de otro usuario (via su cuenta);
//  - una transaccion borrada (soft delete) no aparece en el listado ni en la consulta individual.
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { TransactionsService } from "./transactions.service";

describe("TransactionsService (aislamiento y soft delete)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let service: TransactionsService;
  let userA: { id: string };
  let userB: { id: string };
  let accountA: { id: string };

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    accountsService = new AccountsService(prisma);
    service = new TransactionsService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `tx-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `tx-b-${suffix}@example.test`, passwordHash } });
    accountA = await accountsService.create(userA.id, {
      name: "Cuenta transacciones",
      type: "CHECKING",
      currency: "EUR",
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { accountId: accountA.id } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  async function createRawTransaction(overrides: Partial<{ fingerprint: string }> = {}) {
    return prisma.transaction.create({
      data: {
        accountId: accountA.id,
        date: new Date("2026-08-01"),
        originalDescription: "MOVIMIENTO DE PRUEBA",
        normalizedDescription: "MOVIMIENTO DE PRUEBA",
        amount: -10,
        isExpense: true,
        fingerprint: overrides.fingerprint ?? `fp-${Date.now()}-${Math.random()}`,
      },
    });
  }

  it("un usuario no puede leer una transaccion de una cuenta de otro usuario", async () => {
    const tx = await createRawTransaction();
    await expect(service.findOne(userB.id, tx.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne(userA.id, tx.id)).resolves.toMatchObject({ id: tx.id });
  });

  it("un usuario no puede modificar ni borrar una transaccion de otro usuario", async () => {
    const tx = await createRawTransaction();
    await expect(service.update(userB.id, tx.id, { notes: "hackeado" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(userB.id, tx.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("una transaccion borrada desaparece del listado y de la consulta individual", async () => {
    const tx = await createRawTransaction();
    await service.remove(userA.id, tx.id);

    await expect(service.findOne(userA.id, tx.id)).rejects.toBeInstanceOf(NotFoundException);
    const { items } = await service.findAll(userA.id, { accountId: accountA.id });
    expect(items.find((t) => t.id === tx.id)).toBeUndefined();
  });

  it("el listado de un usuario no incluye transacciones de cuentas de otro usuario", async () => {
    const accountB = await accountsService.create(userB.id, {
      name: "Cuenta de B",
      type: "CHECKING",
      currency: "EUR",
    });
    await prisma.transaction.create({
      data: {
        accountId: accountB.id,
        date: new Date("2026-08-01"),
        originalDescription: "MOVIMIENTO DE B",
        normalizedDescription: "MOVIMIENTO DE B",
        amount: -5,
        isExpense: true,
        fingerprint: `fp-b-${Date.now()}`,
      },
    });

    const { items } = await service.findAll(userA.id, {});
    expect(items.find((t) => t.originalDescription === "MOVIMIENTO DE B")).toBeUndefined();

    await prisma.transaction.deleteMany({ where: { accountId: accountB.id } });
    await prisma.account.delete({ where: { id: accountB.id } });
  });
});
