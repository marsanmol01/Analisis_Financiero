export interface ImportRecord {
  id: string;
  accountId: string;
  filename: string;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  createdAt: string;
}

export interface ColumnMapping {
  date: number;
  valueDate?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  description: number;
  reference?: number;
  currency?: number;
}

export type RowStatus = "new" | "duplicate" | "error";

export interface RowPreview {
  rowNumber: number;
  status: RowStatus;
  reason?: string;
  date?: string;
  valueDate?: string;
  amount?: number;
  currency?: string;
  originalDescription?: string;
  normalizedDescription?: string;
  externalReference?: string;
  fingerprint?: string;
}

export interface PreviewSummary {
  totalRows: number;
  new: number;
  duplicates: number;
  errors: number;
}

export type ImportPreviewResult =
  | { status: "needs_mapping"; headers: string[] }
  | { status: "ok"; headers: string[]; summary: PreviewSummary; rows: RowPreview[] };
