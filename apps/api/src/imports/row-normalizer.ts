import { ColumnMapping } from "./column-mapping";
import { parseAmount } from "./amount-parser";
import { parseDate } from "./date-parser";
import { normalizeDescription } from "./normalize-description";
import { computeFingerprint } from "./fingerprint";

export interface NormalizedRow {
  rowNumber: number;
  date: string;
  valueDate?: string;
  amount: number;
  currency: string;
  originalDescription: string;
  normalizedDescription: string;
  externalReference?: string;
  fingerprint: string;
}

export interface RowError {
  rowNumber: number;
  reason: string;
}

export type NormalizeResult = { status: "ok"; row: NormalizedRow } | { status: "error"; error: RowError };

function getCell(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

function resolveAmount(row: string[], mapping: ColumnMapping): number | null {
  if (mapping.amount !== undefined) {
    const cell = getCell(row, mapping.amount);
    if (!cell) return null;
    return parseAmount(cell);
  }

  const debitCell = getCell(row, mapping.debit);
  const creditCell = getCell(row, mapping.credit);
  if (!debitCell && !creditCell) return null;

  const debit = debitCell ? parseAmount(debitCell) : 0;
  const credit = creditCell ? parseAmount(creditCell) : 0;
  if (debit === null || credit === null) return null;

  return credit - debit;
}

export function normalizeRow(params: {
  accountId: string;
  rawRow: string[];
  rowNumber: number;
  mapping: ColumnMapping;
  defaultCurrency: string;
}): NormalizeResult {
  const { accountId, rawRow, rowNumber, mapping, defaultCurrency } = params;

  const dateCell = getCell(rawRow, mapping.date);
  if (!dateCell) {
    return { status: "error", error: { rowNumber, reason: "Fecha vacía" } };
  }
  const date = parseDate(dateCell);
  if (!date) {
    return { status: "error", error: { rowNumber, reason: `No se pudo interpretar la fecha "${dateCell}"` } };
  }

  const amount = resolveAmount(rawRow, mapping);
  if (amount === null) {
    return { status: "error", error: { rowNumber, reason: "Importe vacío o no numérico" } };
  }

  const descriptionCell = getCell(rawRow, mapping.description);
  if (!descriptionCell) {
    return { status: "error", error: { rowNumber, reason: "Descripción vacía" } };
  }

  const valueDateCell = getCell(rawRow, mapping.valueDate);
  const valueDate = valueDateCell ? parseDate(valueDateCell) : null;
  const referenceCell = getCell(rawRow, mapping.reference) || undefined;
  const currencyCell = getCell(rawRow, mapping.currency);

  const normalizedDescription = normalizeDescription(descriptionCell);
  const fingerprint = computeFingerprint({
    accountId,
    date,
    amount,
    normalizedDescription,
    externalReference: referenceCell,
  });

  return {
    status: "ok",
    row: {
      rowNumber,
      date: date.toISOString(),
      valueDate: valueDate ? valueDate.toISOString() : undefined,
      amount,
      currency: (currencyCell || defaultCurrency).toUpperCase(),
      originalDescription: descriptionCell,
      normalizedDescription,
      externalReference: referenceCell,
      fingerprint,
    },
  };
}
