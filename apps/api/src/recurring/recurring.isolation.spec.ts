import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { RecurringService } from "./recurring.service";

describe("RecurringService (integracion real: deteccion, aislamiento, grupos manuales)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let service: RecurringService;
  let userA: { id: string };
  let userB: { id: string };
  let accountA: { id: string };

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    accountsService = new AccountsService(prisma);
    service = new RecurringService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `recurring-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `recurring-b-${suffix}@example.test`, passwordHash } });
    accountA = await accountsService.create(userA.id, { name: "Cuenta recurrentes", type: "CHECKING", currency: "EUR" });
  });

  afterAll(async () => {
    await prisma.recurringGroup.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.transaction.deleteMany({ where: { accountId: accountA.id } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  let counter = 0;
  async function createTx(accountId: string, date: string, amount: number, description: string) {
    counter++;
    return prisma.transaction.create({
      data: {
        accountId,
        date: new Date(date),
        originalDescription: description,
        normalizedDescription: description,
        amount,
        isExpense: amount < 0,
        isIncome: amount > 0,
        fingerprint: `fp-recurring-test-${counter}-${Date.now()}`,
      },
    });
  }

  it("detecta una suscripcion mensual agrupando por descripcion y calcula el equivalente mensual/anual", async () => {
    await createTx(accountA.id, "2026-05-20", -12.99, "NETFLIX.COM RECURRING TEST");
    await createTx(accountA.id, "2026-06-20", -12.99, "NETFLIX.COM RECURRING TEST");
    await createTx(accountA.id, "2026-07-20", -12.99, "NETFLIX.COM RECURRING TEST");

    const result = await service.detect(userA.id, { accountId: accountA.id });

    expect(result.groupsCreated).toBe(1);
    expect(result.transactionsLinked).toBe(3);

    const groups = await service.findAll(userA.id, {});
    const netflix = groups.find((g) => g.description === "NETFLIX.COM RECURRING TEST");
    expect(netflix?.frequency).toBe("MONTHLY");
    expect(Number(netflix?.typicalAmount)).toBeCloseTo(-12.99);
    expect(netflix?.monthlyEquivalent).toBeCloseTo(-12.99, 1);
    expect(netflix?.annualEstimate).toBeCloseTo(-155.88, 1);
  });

  it("volver a ejecutar detect actualiza el mismo grupo (no crea uno duplicado) al añadir una nueva ocurrencia", async () => {
    await createTx(accountA.id, "2026-08-20", -12.99, "NETFLIX.COM RECURRING TEST");

    const before = await service.findAll(userA.id, { accountId: accountA.id });
    const result = await service.detect(userA.id, { accountId: accountA.id });
    const after = await service.findAll(userA.id, { accountId: accountA.id });

    expect(result.groupsCreated).toBe(0);
    expect(result.groupsUpdated).toBeGreaterThanOrEqual(1);
    expect(after.length).toBe(before.length);

    const netflix = after.find((g) => g.description === "NETFLIX.COM RECURRING TEST");
    expect(netflix?.lastDate.toISOString().slice(0, 10)).toBe("2026-08-20");
  });

  it("no agrupa compras ocasionales con importes muy dispares en el mismo comercio", async () => {
    await createTx(accountA.id, "2026-06-01", -8, "BAR ESPORADICO TEST");
    await createTx(accountA.id, "2026-07-15", -35, "BAR ESPORADICO TEST");

    await service.detect(userA.id, { accountId: accountA.id });

    const groups = await service.findAll(userA.id, { accountId: accountA.id });
    expect(groups.find((g) => g.description === "BAR ESPORADICO TEST")).toBeUndefined();
  });

  it("createManual crea un grupo a partir de transacciones elegidas a mano, aunque el detector automatico no las hubiese agrupado todavia", async () => {
    const t1 = await createTx(accountA.id, "2026-07-01", -9.99, "SERVICIO NUEVO MARCADO A MANO");
    const t2 = await createTx(accountA.id, "2026-08-01", -9.99, "SERVICIO NUEVO MARCADO A MANO");

    const group = await service.createManual(userA.id, { transactionIds: [t1.id, t2.id] });

    expect(group.isManual).toBe(true);
    expect(group.frequency).toBe("MONTHLY");

    const refreshed1 = await prisma.transaction.findUnique({ where: { id: t1.id } });
    expect(refreshed1?.recurringGroupId).toBe(group.id);
  });

  it("createManual rechaza transacciones de mas de una cuenta", async () => {
    const accountA2 = await accountsService.create(userA.id, { name: "Otra cuenta", type: "SAVINGS", currency: "EUR" });
    const t1 = await createTx(accountA.id, "2026-07-01", -20, "MEZCLA CUENTAS");
    const t2 = await createTx(accountA2.id, "2026-08-01", -20, "MEZCLA CUENTAS");

    await expect(service.createManual(userA.id, { transactionIds: [t1.id, t2.id] })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await prisma.transaction.deleteMany({ where: { accountId: accountA2.id } });
    await prisma.account.delete({ where: { id: accountA2.id } });
  });

  it("detect() no toca las transacciones ya asignadas a un grupo manual", async () => {
    const before = await service.findAll(userA.id, { accountId: accountA.id });
    await service.detect(userA.id, { accountId: accountA.id });
    const after = await service.findAll(userA.id, { accountId: accountA.id });

    // El grupo manual "SERVICIO NUEVO MARCADO A MANO" debe seguir existiendo tal cual, sin que
    // detect() haya creado un grupo automatico competidor con la misma clave.
    const manualGroups = after.filter((g) => g.description === "SERVICIO NUEVO MARCADO A MANO");
    expect(manualGroups).toHaveLength(1);
    expect(manualGroups[0].isManual).toBe(true);
    expect(after.length).toBe(before.length);
  });

  it("un usuario no puede ver, editar ni borrar el grupo recurrente de otro usuario", async () => {
    const anyGroup = (await service.findAll(userA.id, {}))[0];
    expect(anyGroup).toBeDefined();

    await expect(service.findOne(userB.id, anyGroup.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(userB.id, anyGroup.id, { isActive: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove(userB.id, anyGroup.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("no agrupa transacciones de otro usuario aunque coincidan comercio e importe", async () => {
    const accountB = await accountsService.create(userB.id, { name: "Cuenta de B", type: "CHECKING", currency: "EUR" });
    await createTx(accountB.id, "2026-06-10", -9.99, "SUSCRIPCION COMPARTIDA TEST");
    await createTx(accountB.id, "2026-07-10", -9.99, "SUSCRIPCION COMPARTIDA TEST");

    const result = await service.detect(userB.id, { accountId: accountB.id });
    expect(result.groupsCreated).toBe(1);

    // El detect() de A no debe haber creado ni tocado nada con esa descripcion de B.
    const groupsA = await service.findAll(userA.id, {});
    expect(groupsA.find((g) => g.description === "SUSCRIPCION COMPARTIDA TEST")).toBeUndefined();

    await prisma.recurringGroup.deleteMany({ where: { userId: userB.id } });
    await prisma.transaction.deleteMany({ where: { accountId: accountB.id } });
    await prisma.account.delete({ where: { id: accountB.id } });
  });

  it("borrar un grupo desvincula sus transacciones sin borrarlas", async () => {
    const group = (await service.findAll(userA.id, { accountId: accountA.id })).find(
      (g) => g.description === "SERVICIO NUEVO MARCADO A MANO",
    )!;
    const linkedBefore = await prisma.transaction.findMany({ where: { recurringGroupId: group.id } });
    expect(linkedBefore.length).toBeGreaterThan(0);

    await service.remove(userA.id, group.id);

    const stillThere = await prisma.transaction.findUnique({ where: { id: linkedBefore[0].id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.recurringGroupId).toBeNull();
  });
});
