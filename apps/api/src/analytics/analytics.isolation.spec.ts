// Test de integracion real. Cubre el caso explicitamente exigido en los requisitos:
// "una transferencia interna no suma gasto ni ingreso" — aqui es donde finalmente se verifica
// en la practica, usando el motor de analitica sobre datos reales en Postgres.
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService (integracion real: transferencias, aislamiento, agregados)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let service: AnalyticsService;
  let userA: { id: string };
  let userB: { id: string };
  let accountA: { id: string };
  let categoryId: string;
  let counter = 0;

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    accountsService = new AccountsService(prisma);
    service = new AnalyticsService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `analytics-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `analytics-b-${suffix}@example.test`, passwordHash } });
    accountA = await accountsService.create(userA.id, {
      name: "Cuenta analitica",
      type: "CHECKING",
      currency: "EUR",
      balance: 5000,
    });

    const category = await prisma.category.findFirst({ where: { isSystem: true } });
    if (!category) throw new Error("Se esperaban categorías del sistema ya sembradas (npm run prisma:seed)");
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { accountId: accountA.id } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  async function createTx(
    accountId: string,
    date: string,
    amount: number,
    description: string,
    extra: Partial<{ isInternalTransfer: boolean; categoryId: string; merchantId: string }> = {},
  ) {
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
        fingerprint: `fp-analytics-test-${counter}-${Date.now()}`,
        isInternalTransfer: extra.isInternalTransfer ?? false,
        categoryId: extra.categoryId,
        merchantId: extra.merchantId,
      },
    });
  }

  it("una transferencia interna confirmada no suma como gasto ni como ingreso en el resumen mensual", async () => {
    await createTx(accountA.id, "2026-08-05", 3250, "NOMINA");
    await createTx(accountA.id, "2026-08-10", -2180, "GASTOS VARIOS", { categoryId });
    // Transferencia interna: no debe contar ni como gasto ni como ingreso.
    await createTx(accountA.id, "2026-08-12", -1000, "TRASPASO A AHORRO", { isInternalTransfer: true });
    await createTx(accountA.id, "2026-08-12", 1000, "TRASPASO DESDE CORRIENTE", { isInternalTransfer: true });

    const summary = await service.getSummary(userA.id, { month: "2026-08", accountId: accountA.id });

    expect(summary.income).toBe(3250);
    expect(summary.expenses).toBe(2180);
    expect(summary.savings).toBe(1070);
    expect(summary.savingsRate).toBeCloseTo(32.9, 1);
  });

  it("compara correctamente con el mes anterior", async () => {
    await createTx(accountA.id, "2026-07-05", 3000, "NOMINA JULIO");
    await createTx(accountA.id, "2026-07-10", -2000, "GASTOS JULIO", { categoryId });

    const summary = await service.getSummary(userA.id, { month: "2026-08", accountId: accountA.id });

    expect(summary.previousMonth.month).toBe("2026-07");
    expect(summary.previousMonth.income).toBe(3000);
    expect(summary.previousMonth.expenses).toBe(2000);
    expect(summary.previousMonth.incomeChangePercent).toBeCloseTo(8.33, 1);
  });

  it("la evolucion mensual agrupa correctamente varios meses seguidos", async () => {
    const evolution = await service.getMonthlyEvolution(userA.id, {
      months: 2,
      month: "2026-08",
      accountId: accountA.id,
    });

    expect(evolution.map((e) => e.month)).toEqual(["2026-07", "2026-08"]);
    expect(evolution[0].income).toBe(3000);
    expect(evolution[1].income).toBe(3250);
  });

  it("el desglose por categoria excluye transferencias internas y solo cuenta gastos", async () => {
    const breakdown = await service.getByCategory(userA.id, {
      from: "2026-08-01",
      to: "2026-08-31",
      accountId: accountA.id,
    });

    const total = breakdown.reduce((sum, b) => sum + b.total, 0);
    expect(total).toBe(2180); // no incluye los 1000 de la transferencia interna
  });

  it("mayores gastos ordena de mayor a menor y excluye transferencias internas", async () => {
    const top = await service.getTopExpenses(userA.id, {
      from: "2026-08-01",
      to: "2026-08-31",
      accountId: accountA.id,
      limit: 5,
    });

    expect(top[0].originalDescription).toBe("GASTOS VARIOS");
    expect(top.find((t) => t.originalDescription === "TRASPASO A AHORRO")).toBeUndefined();
  });

  it("el patrimonio neto suma los saldos de las cuentas activas del usuario", async () => {
    const netWorth = await service.getNetWorth(userA.id);

    expect(netWorth.totalAssets).toBe(5000);
    expect(netWorth.totalLiabilities).toBe(0);
    expect(netWorth.netWorth).toBe(5000);
  });

  it("una cuenta de tipo LOAN se trata como pasivo", async () => {
    const loanAccount = await accountsService.create(userA.id, {
      name: "Prestamo coche",
      type: "LOAN",
      currency: "EUR",
      balance: -8000,
    });

    const netWorth = await service.getNetWorth(userA.id);

    expect(netWorth.totalLiabilities).toBe(-8000);
    expect(netWorth.netWorth).toBe(5000 - 8000);

    await prisma.account.delete({ where: { id: loanAccount.id } });
  });

  it("un usuario no ve datos de otro usuario en ningun agregado", async () => {
    const accountB = await accountsService.create(userB.id, {
      name: "Cuenta de B",
      type: "CHECKING",
      currency: "EUR",
      balance: 99999,
    });
    await createTx(accountB.id, "2026-08-05", 50000, "INGRESO GIGANTE DE B");

    const summaryA = await service.getSummary(userA.id, { month: "2026-08" });
    expect(summaryA.income).toBeLessThan(50000);

    const netWorthA = await service.getNetWorth(userA.id);
    expect(netWorthA.accounts.find((a) => a.id === accountB.id)).toBeUndefined();

    await prisma.transaction.deleteMany({ where: { accountId: accountB.id } });
    await prisma.account.delete({ where: { id: accountB.id } });
  });
});
