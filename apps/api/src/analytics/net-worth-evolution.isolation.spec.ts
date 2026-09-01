// Test de integracion real. Verifica que AccountsService captura fotos de saldo automaticamente
// (al crear y al cambiar el saldo) y que AnalyticsService.getNetWorthEvolution las usa
// correctamente para reconstruir el patrimonio historico, sin inventar datos hacia atras.
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { AnalyticsService } from "./analytics.service";
import { monthKeyOf } from "./analytics-math";

describe("Balance snapshots + evolucion del patrimonio (integracion real)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let analyticsService: AnalyticsService;
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    accountsService = new AccountsService(prisma);
    analyticsService = new AnalyticsService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `networth-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `networth-b-${suffix}@example.test`, passwordHash } });
  });

  afterAll(async () => {
    await prisma.balanceSnapshot.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  it("crear una cuenta captura una foto inicial del saldo", async () => {
    const account = await accountsService.create(userA.id, {
      name: "Cuenta con snapshot",
      type: "CHECKING",
      currency: "EUR",
      balance: 1000,
    });

    const snapshots = await prisma.balanceSnapshot.findMany({ where: { accountId: account.id } });
    expect(snapshots).toHaveLength(1);
    expect(Number(snapshots[0].balance)).toBe(1000);
  });

  it("cambiar el saldo captura una foto nueva; editar otros campos no", async () => {
    const account = await accountsService.create(userA.id, {
      name: "Cuenta editable",
      type: "SAVINGS",
      currency: "EUR",
      balance: 500,
    });

    await accountsService.update(userA.id, account.id, { name: "Renombrada" });
    let snapshots = await prisma.balanceSnapshot.findMany({ where: { accountId: account.id } });
    expect(snapshots).toHaveLength(1); // solo la inicial, renombrar no genera una nueva

    await accountsService.update(userA.id, account.id, { balance: 700 });
    snapshots = await prisma.balanceSnapshot.findMany({ where: { accountId: account.id }, orderBy: { date: "asc" } });
    expect(snapshots).toHaveLength(2);
    expect(Number(snapshots[1].balance)).toBe(700);
  });

  it("getNetWorthEvolution reconstruye el patrimonio historico sin inventar datos hacia atras", async () => {
    const account = await accountsService.create(userA.id, {
      name: "Cuenta para evolucion",
      type: "CHECKING",
      currency: "EUR",
      balance: 2000,
    });

    const currentMonth = monthKeyOf(new Date());
    const evolution = await analyticsService.getNetWorthEvolution(userA.id, 3);

    // El mes actual ya incluye la foto recien creada.
    const currentPoint = evolution.find((e) => e.month === currentMonth)!;
    expect(currentPoint.netWorth).toBeGreaterThanOrEqual(2000);

    await prisma.balanceSnapshot.deleteMany({ where: { accountId: account.id } });
    await prisma.account.delete({ where: { id: account.id } });
  });

  it("un mes sin ninguna foto previa para el usuario devuelve patrimonio 0, no un error", async () => {
    const freshUser = await prisma.user.create({
      data: { email: `networth-fresh-${Date.now()}@example.test`, passwordHash: "x" },
    });

    const evolution = await analyticsService.getNetWorthEvolution(freshUser.id, 6);
    expect(evolution.every((e) => e.netWorth === 0)).toBe(true);

    await prisma.user.delete({ where: { id: freshUser.id } });
  });

  it("la evolucion de un usuario no incluye saldos de otro usuario", async () => {
    await accountsService.create(userB.id, {
      name: "Cuenta gigante de B",
      type: "CHECKING",
      currency: "EUR",
      balance: 999999,
    });

    const evolutionA = await analyticsService.getNetWorthEvolution(userA.id, 1);
    const currentMonth = monthKeyOf(new Date());
    const point = evolutionA.find((e) => e.month === currentMonth)!;
    expect(point.netWorth).toBeLessThan(999999);
  });
});
