import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { ColumnMapping, ImportPreviewResult, ImportRecord, RowPreview } from "../types/import";

export function useImports() {
  return useQuery({
    queryKey: ["imports"],
    queryFn: () => api.get<ImportRecord[]>("/imports"),
  });
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: ({
      accountId,
      file,
      columnMapping,
    }: {
      accountId: string;
      file: File;
      columnMapping?: ColumnMapping;
    }) => {
      const form = new FormData();
      form.append("accountId", accountId);
      form.append("file", file);
      if (columnMapping) form.append("columnMapping", JSON.stringify(columnMapping));
      return api.post<ImportPreviewResult>("/imports/preview", form);
    },
  });
}

export interface ConfirmImportInput {
  accountId: string;
  filename: string;
  rows: RowPreview[];
}

export function useConfirmImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, filename, rows }: ConfirmImportInput) =>
      api.post<ImportRecord>("/imports/confirm", {
        accountId,
        filename,
        rows: rows.map((row) => ({
          rowNumber: row.rowNumber,
          date: row.date,
          valueDate: row.valueDate,
          amount: row.amount,
          currency: row.currency,
          originalDescription: row.originalDescription,
          normalizedDescription: row.normalizedDescription,
          externalReference: row.externalReference,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["imports"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
