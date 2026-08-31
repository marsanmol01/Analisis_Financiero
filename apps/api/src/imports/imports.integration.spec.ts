// Test de integracion real (no mockeado) contra la base de datos de desarrollo/test.
// Cubre los dos requisitos mas criticos de este bloque:
//  - importar el mismo fichero dos veces no duplica movimientos;
//  - un usuario no puede importar contra la cuenta de otro usuario.
import path from "node:path";
import fs from "node:fs";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { ImportsService, UploadedFileLike } from "./imports.service";

const FIXTURE_PATH = path.resolve(__dirname, "../../../../fixtures/generic-bank-sample.csv");

function toFile(buffer: Buffer, name: string): UploadedFileLike {
  return { originalname: name, mimetype: "text/csv", buffer };
}

describe("ImportsService (integracion)", () => {
  let prisma: PrismaService;
  let accountsService: AccountsService;
  let importsService: ImportsService;
  let userA: { id: string };
  let userB: { id: string };
  let accountA: { id: string };

  beforeAll(async () => {
    const config = { getOrThrow: (key: string) => process.env[key] } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
    accountsService = new AccountsService(prisma);
    importsService = new ImportsService(prisma, accountsService);

    const passwordHash = await argon2.hash("not-used-in-this-test", { type: argon2.argon2id });
    const suffix = Date.now();
    userA = await prisma.user.create({ data: { email: `imports-a-${suffix}@example.test`, passwordHash } });
    userB = await prisma.user.create({ data: { email: `imports-b-${suffix}@example.test`, passwordHash } });
    accountA = await accountsService.create(userA.id, {
      name: "Cuenta de pruebas de importacion",
      type: "CHECKING",
      currency: "EUR",
    });
  });

  afterAll(async () => {
    await prisma.import.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.transaction.deleteMany({ where: { accountId: accountA.id } });
    await prisma.account.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  it("previsualiza el fixture, detecta columnas y no crea nada en base de datos", async () => {
    const buffer = fs.readFileSync(FIXTURE_PATH);
    const preview = await importsService.preview(userA.id, accountA.id, toFile(buffer, "sample.csv"));

    expect(preview.status).toBe("ok");
    if (preview.status !== "ok") throw new Error("unreachable");
    expect(preview.summary.new).toBe(11);
    expect(preview.summary.duplicates).toBe(0);
    expect(preview.summary.errors).toBe(0);

    const count = await prisma.transaction.count({ where: { accountId: accountA.id } });
    expect(count).toBe(0);
  });

  it("confirmar la importacion crea las transacciones y registra el Import", async () => {
    const buffer = fs.readFileSync(FIXTURE_PATH);
    const preview = await importsService.preview(userA.id, accountA.id, toFile(buffer, "sample.csv"));
    if (preview.status !== "ok") throw new Error("unreachable");

    const importRecord = await importsService.confirm(userA.id, {
      accountId: accountA.id,
      filename: "sample.csv",
      rows: preview.rows.filter((r) => r.status === "new") as never,
    });

    expect(importRecord.importedCount).toBe(11);
    expect(importRecord.duplicateCount).toBe(0);

    const count = await prisma.transaction.count({ where: { accountId: accountA.id } });
    expect(count).toBe(11);
  });

  it("importar el mismo fichero una segunda vez no duplica movimientos", async () => {
    const beforeCount = await prisma.transaction.count({ where: { accountId: accountA.id } });

    const buffer = fs.readFileSync(FIXTURE_PATH);
    const preview = await importsService.preview(userA.id, accountA.id, toFile(buffer, "sample.csv"));
    if (preview.status !== "ok") throw new Error("unreachable");

    // La segunda vez, todas las filas deben salir como duplicadas en el preview.
    expect(preview.summary.new).toBe(0);
    expect(preview.summary.duplicates).toBe(11);

    // Aunque el cliente reenviase las filas igualmente (o el DB constraint actuase de red de
    // seguridad), confirmar no debe crear transacciones nuevas.
    const importRecord = await importsService.confirm(userA.id, {
      accountId: accountA.id,
      filename: "sample.csv",
      rows: preview.rows as never,
    });

    expect(importRecord.importedCount).toBe(0);
    expect(importRecord.duplicateCount).toBe(11);

    const afterCount = await prisma.transaction.count({ where: { accountId: accountA.id } });
    expect(afterCount).toBe(beforeCount);
  });

  it("un usuario no puede previsualizar ni confirmar una importacion contra la cuenta de otro usuario", async () => {
    const buffer = fs.readFileSync(FIXTURE_PATH);

    await expect(importsService.preview(userB.id, accountA.id, toFile(buffer, "sample.csv"))).rejects.toBeInstanceOf(
      NotFoundException,
    );

    await expect(
      importsService.confirm(userB.id, {
        accountId: accountA.id,
        filename: "sample.csv",
        rows: [
          {
            rowNumber: 2,
            date: new Date().toISOString(),
            amount: 1,
            currency: "EUR",
            originalDescription: "x",
            normalizedDescription: "X",
          },
        ] as never,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("una fila con fecha o importe ilegible se marca como error, no se descarta en silencio", async () => {
    const csv = "Fecha,Concepto,Importe\nno-es-una-fecha,MERCADONA,-45.30\n01/08/2026,SIN IMPORTE,\n";
    const preview = await importsService.preview(userA.id, accountA.id, toFile(Buffer.from(csv), "malformado.csv"));

    expect(preview.status).toBe("ok");
    if (preview.status !== "ok") throw new Error("unreachable");
    expect(preview.summary.errors).toBe(2);
    expect(preview.rows.every((r) => r.status === "error")).toBe(true);
    expect(preview.rows[0].reason).toMatch(/fecha/i);
    expect(preview.rows[1].reason).toMatch(/importe/i);
  });
});
