import { BadRequestException, Injectable } from "@nestjs/common";
import { Import, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { ClassificationService } from "../classification/classification.service";
import { GenericCsvImporter } from "./importers/generic-csv.importer";
import { GenericXlsxImporter } from "./importers/generic-xlsx.importer";
import { BankImporter } from "./importers/bank-importer.interface";
import { ColumnMapping, detectColumnMapping } from "./column-mapping";
import { normalizeRow } from "./row-normalizer";
import { computeFingerprint } from "./fingerprint";
import { normalizeDescription } from "./normalize-description";
import { ImportPreviewResult, RowPreview } from "./preview-result.types";
import { ConfirmImportDto } from "./dto/confirm-import.dto";

const MAX_ROWS = 20_000;

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly classificationService: ClassificationService,
  ) {}

  private resolveImporter(file: UploadedFileLike): BankImporter {
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".csv") || file.mimetype === "text/csv") {
      return new GenericCsvImporter();
    }
    if (name.endsWith(".xlsx") || file.mimetype.includes("spreadsheetml")) {
      return new GenericXlsxImporter();
    }
    throw new BadRequestException("Formato de fichero no soportado. Usa CSV o XLSX.");
  }

  private parseColumnMappingOverride(raw?: string): ColumnMapping | undefined {
    if (!raw) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException("columnMapping no es un JSON válido");
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new BadRequestException("columnMapping debe ser un objeto");
    }
    const mapping = parsed as Record<string, unknown>;
    if (typeof mapping.date !== "number" || typeof mapping.description !== "number") {
      throw new BadRequestException("columnMapping debe incluir al menos 'date' y 'description'");
    }
    return mapping as unknown as ColumnMapping;
  }

  async preview(
    userId: string,
    accountId: string,
    file: UploadedFileLike,
    columnMappingOverride?: string,
  ): Promise<ImportPreviewResult> {
    const account = await this.accountsService.findOne(userId, accountId);
    const importer = this.resolveImporter(file);
    const parsed = await importer.parse(file.buffer);

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      return { status: "ok", headers: parsed.headers, summary: { totalRows: 0, new: 0, duplicates: 0, errors: 0 }, rows: [] };
    }

    if (parsed.rows.length > MAX_ROWS) {
      throw new BadRequestException(`El fichero supera el máximo admitido de ${MAX_ROWS} filas`);
    }

    const override = this.parseColumnMappingOverride(columnMappingOverride);
    const mapping = override ?? detectColumnMapping(parsed.headers);
    if (!mapping) {
      return { status: "needs_mapping", headers: parsed.headers };
    }

    const rowPreviews: RowPreview[] = [];
    const seenInBatch = new Set<string>();
    const okFingerprints: string[] = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const rowNumber = i + 2; // fila 1 = cabecera
      const result = normalizeRow({
        accountId,
        rawRow: parsed.rows[i],
        rowNumber,
        mapping,
        defaultCurrency: account.currency,
      });

      if (result.status === "error") {
        rowPreviews.push({ rowNumber, status: "error", reason: result.error.reason });
        continue;
      }

      if (seenInBatch.has(result.row.fingerprint)) {
        rowPreviews.push({ ...result.row, status: "duplicate", reason: "Duplicado dentro del propio fichero" });
        continue;
      }
      seenInBatch.add(result.row.fingerprint);
      okFingerprints.push(result.row.fingerprint);
      rowPreviews.push({ ...result.row, status: "new" });
    }

    const existing = await this.prisma.transaction.findMany({
      where: { accountId, deletedAt: null, fingerprint: { in: okFingerprints } },
      select: { fingerprint: true },
    });
    const existingSet = new Set(existing.map((t) => t.fingerprint));

    for (const row of rowPreviews) {
      if (row.status === "new" && row.fingerprint && existingSet.has(row.fingerprint)) {
        row.status = "duplicate";
        row.reason = "Ya existe un movimiento igual en esta cuenta";
      }
    }

    const summary = {
      totalRows: rowPreviews.length,
      new: rowPreviews.filter((r) => r.status === "new").length,
      duplicates: rowPreviews.filter((r) => r.status === "duplicate").length,
      errors: rowPreviews.filter((r) => r.status === "error").length,
    };

    return { status: "ok", headers: parsed.headers, summary, rows: rowPreviews };
  }

  async confirm(userId: string, dto: ConfirmImportDto): Promise<Import> {
    const account = await this.accountsService.findOne(userId, dto.accountId);
    const ruleSet = await this.classificationService.loadRuleSet(userId);

    // La huella nunca se toma del cliente: se recalcula aqui a partir de los datos de la fila.
    const recomputed = dto.rows.map((row) => {
      const normalizedDescription = normalizeDescription(row.normalizedDescription || row.originalDescription);
      const fingerprint = computeFingerprint({
        accountId: dto.accountId,
        date: new Date(row.date),
        amount: row.amount,
        normalizedDescription,
        externalReference: row.externalReference,
      });
      return { row, normalizedDescription, fingerprint };
    });

    const existing = await this.prisma.transaction.findMany({
      where: {
        accountId: dto.accountId,
        deletedAt: null,
        fingerprint: { in: recomputed.map((r) => r.fingerprint) },
      },
      select: { fingerprint: true },
    });
    const existingSet = new Set(existing.map((t) => t.fingerprint));

    const seenInBatch = new Set<string>();
    const toCreate: Prisma.TransactionCreateManyInput[] = [];
    let duplicateCount = 0;

    for (const { row, normalizedDescription, fingerprint } of recomputed) {
      if (existingSet.has(fingerprint) || seenInBatch.has(fingerprint)) {
        duplicateCount++;
        continue;
      }
      seenInBatch.add(fingerprint);

      const classification = this.classificationService.classify(ruleSet, {
        accountId: dto.accountId,
        amount: row.amount,
        normalizedDescription,
      });

      toCreate.push({
        accountId: dto.accountId,
        date: new Date(row.date),
        valueDate: row.valueDate ? new Date(row.valueDate) : undefined,
        originalDescription: row.originalDescription,
        normalizedDescription,
        amount: row.amount,
        currency: row.currency || account.currency,
        isIncome: row.amount > 0,
        isExpense: row.amount < 0,
        sourceFile: dto.filename,
        externalReference: row.externalReference,
        fingerprint,
        categoryId: classification.categoryId,
        merchantId: classification.merchantId,
        classificationSource: classification.source,
        confidence: classification.confidence,
      });
    }

    const created =
      toCreate.length > 0
        ? await this.prisma.transaction.createMany({ data: toCreate, skipDuplicates: true })
        : { count: 0 };

    // Si skipDuplicates evito alguna fila por colision de la restriccion unica (carrera con otra
    // importacion concurrente), tambien cuenta como duplicado en el resumen.
    duplicateCount += toCreate.length - created.count;

    const importRecord = await this.prisma.import.create({
      data: {
        userId,
        accountId: dto.accountId,
        filename: dto.filename,
        totalRows: dto.rows.length,
        importedCount: created.count,
        duplicateCount,
        errorCount: 0,
      },
    });

    return importRecord;
  }

  findAll(userId: string): Promise<Import[]> {
    return this.prisma.import.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }
}
