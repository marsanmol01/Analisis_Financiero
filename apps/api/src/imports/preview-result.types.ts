import { NormalizedRow } from "./row-normalizer";

export type RowStatus = "new" | "duplicate" | "error";

export interface RowPreview extends Partial<NormalizedRow> {
  rowNumber: number;
  status: RowStatus;
  reason?: string;
}

export interface PreviewSummary {
  totalRows: number;
  new: number;
  duplicates: number;
  errors: number;
}

export type ImportPreviewResult =
  | { status: "needs_mapping"; headers: string[] }
  | {
      status: "ok";
      headers: string[];
      summary: PreviewSummary;
      rows: RowPreview[];
    };
