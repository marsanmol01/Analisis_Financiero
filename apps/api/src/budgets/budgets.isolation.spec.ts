import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { monthKeyOf } from "../analytics/analytics-math";
import { BudgetsService } from "./budgets.service";

describe("BudgetsService (integracion real: progreso, aislamiento, exclusion de transferencias)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let service: BudgetsService;
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
    service = new BudgetsService(prisma);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `budgets-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `budgets-b-${suffix}@example.test`, passwordHash } });
    accountA = await accountsService.create(userA.id, { name: "Cuenta presupuestos", type: "CHECKING", currency: "EUR" });

    const category = await prisma.category.findFirst({ where: { isSystem: true } });
    if (!category) throw new Error("Se esperaban categorías del sistema ya sembradas (npm run prisma:seed)");
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.budget.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.transaction.deleteMany({ where: { accountId: accountA.id } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  async function createTx(
    date: string,
    amount: number,
    description: string,
    extra: Partial<{ isInternalTransfer: boolean; categoryId: string }> = {},
  ) {
    counter++;
    return prisma.transaction.create({
      data: {
        accountId: accountA.id,
        date: new Date(date),
        originalDescription: description,
        normalizedDescription: description,
        amount,
        isExpense: amount < 0,
        isIncome: amount > 0,
        fingerprint: `fp-budgets-test-${counter}-${Date.now()}`,
        isInternalTransfer: extra.isInternalTransfer ?? false,
        categoryId: extra.categoryId,
      },
    });
  }

  it("rechaza crear un segundo presupuesto general para el mismo usuario", async () => {
    await service.create(userA.id, { amount: 2000 });
    await expect(service.create(userA.id, { amount: 500 })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rechaza crear un segundo presupuesto para la misma categoría", async () => {
    await service.create(userA.id, { categoryId, amount: 300 });
    await expect(service.create(userA.id, { categoryId, amount: 100 })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rechaza una categoría que no existe o no es accesible", async () => {
    await expect(service.create(userA.id, { categoryId: "00000000-0000-0000-0000-000000000000", amount: 100 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("calcula el progreso del presupuesto de categoría excluyendo transferencias internas y otras categorías", async () => {
    const past = "2025-01"; // mes ya cerrado, para que la proyeccion salga null
    await createTx(`${past}-05`, -150, "GASTO EN LA CATEGORIA", { categoryId });
    await createTx(`${past}-10`, -999, "GASTO DE OTRA CATEGORIA"); // sin categoria, no debe contar aqui
    await createTx(`${past}-15`, -50, "TRASPASO INTERNO", { categoryId, isInternalTransfer: true });

    const progress = await service.getProgress(userA.id, { month: past });
    const categoryProgress = progress.find((p) => p.categoryId === categoryId)!;

    expect(categoryProgress.spent).toBe(150);
    expect(categoryProgress.remaining).toBe(150); // presupuesto 300 - 150
    expect(categoryProgress.percentageConsumed).toBeCloseTo(50, 1);
    expect(categoryProgress.alertLevel).toBeNull();
    expect(categoryProgress.projection).toBeNull(); // no es el mes en curso
  });

  it("el presupuesto general suma todo el gasto del mes, incluida la categoria presupuestada", async () => {
    const past = "2025-01";
    const progress = await service.getProgress(userA.id, { month: past });
    const general = progress.find((p) => p.categoryId === null)!;

    // 150 (categoria) + 999 (sin categoria) = 1149; el traspaso interno (-50) queda excluido
    expect(general.spent).toBe(1149);
  });

  it("dispara la alerta correcta al superar un umbral", async () => {
    const month = "2025-02";
    await createTx(`${month}-01`, -270, "GASTO ALTO EN CATEGORIA", { categoryId }); // 270/300 = 90%

    const progress = await service.getProgress(userA.id, { month });
    const categoryProgress = progress.find((p) => p.categoryId === categoryId)!;

    expect(categoryProgress.percentageConsumed).toBeCloseTo(90, 1);
    expect(categoryProgress.alertLevel).toBe(90);
  });

  it("solo proyecta a fin de mes cuando se consulta el mes en curso", async () => {
    const currentMonth = monthKeyOf(new Date());
    await createTx(`${currentMonth}-01`, -100, "GASTO GENERAL DEL MES ACTUAL");

    const progress = await service.getProgress(userA.id, { month: currentMonth });
    const general = progress.find((p) => p.categoryId === null)!;

    expect(general.projection).not.toBeNull();
  });

  it("un usuario no puede leer, editar ni borrar el presupuesto de otro usuario", async () => {
    const budget = (await service.findAll(userA.id))[0];

    await expect(service.findOne(userB.id, budget.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(userB.id, budget.id, { amount: 1 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(userB.id, budget.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("el progreso de un usuario no incluye presupuestos ni gastos de otro usuario", async () => {
    const accountB = await accountsService.create(userB.id, { name: "Cuenta de B", type: "CHECKING", currency: "EUR" });
    await prisma.budget.create({ data: { userId: userB.id, amount: 999999 } });
    await prisma.transaction.create({
      data: {
        accountId: accountB.id,
        date: new Date(),
        originalDescription: "GASTO GIGANTE DE B",
        normalizedDescription: "GASTO GIGANTE DE B",
        amount: -50000,
        isExpense: true,
        fingerprint: `fp-budgets-b-${Date.now()}`,
      },
    });

    const progressA = await service.getProgress(userA.id, {});
    const generalA = progressA.find((p) => p.categoryId === null)!;
    expect(generalA.spent).toBeLessThan(50000);

    await prisma.budget.deleteMany({ where: { userId: userB.id } });
    await prisma.transaction.deleteMany({ where: { accountId: accountB.id } });
    await prisma.account.delete({ where: { id: accountB.id } });
  });
});
