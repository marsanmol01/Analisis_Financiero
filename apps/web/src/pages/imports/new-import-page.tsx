import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, FileUp } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useAccounts } from "../../hooks/use-accounts";
import { useConfirmImport, usePreviewImport } from "../../hooks/use-imports";
import { ApiError } from "../../lib/api-client";
import { formatCurrency, formatDate } from "../../lib/format";
import type { ColumnMapping, ImportRecord, RowPreview } from "../../types/import";
import { ColumnMappingForm } from "./column-mapping-form";

type Step = "upload" | "mapping" | "preview" | "done";

const STATUS_LABELS: Record<RowPreview["status"], string> = {
  new: "Nuevo",
  duplicate: "Duplicado",
  error: "Error",
};

export function NewImportPage() {
  const navigate = useNavigate();
  const { data: accounts } = useAccounts();
  const previewImport = usePreviewImport();
  const confirmImport = useConfirmImport();

  const [step, setStep] = useState<Step>("upload");
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | undefined>(undefined);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RowPreview[]>([]);
  const [summary, setSummary] = useState({ totalRows: 0, new: 0, duplicates: 0, errors: 0 });
  const [confirmedImport, setConfirmedImport] = useState<ImportRecord | undefined>(undefined);

  function runPreview(columnMapping?: ColumnMapping) {
    if (!file || !accountId) return;
    previewImport.mutate(
      { accountId, file, columnMapping },
      {
        onSuccess: (result) => {
          if (result.status === "needs_mapping") {
            setHeaders(result.headers);
            setStep("mapping");
            return;
          }
          setHeaders(result.headers);
          setRows(result.rows);
          setSummary(result.summary);
          setStep("preview");
        },
      },
    );
  }

  function handleUploadSubmit(event: FormEvent) {
    event.preventDefault();
    runPreview();
  }

  function handleConfirm() {
    if (!file || !accountId) return;
    const newRows = rows.filter((row) => row.status === "new");
    confirmImport.mutate(
      { accountId, filename: file.name, rows: newRows },
      {
        onSuccess: (record) => {
          setConfirmedImport(record);
          setStep("done");
        },
      },
    );
  }

  function resetWizard() {
    setStep("upload");
    setFile(undefined);
    setHeaders([]);
    setRows([]);
    setSummary({ totalRows: 0, new: 0, duplicates: 0, errors: 0 });
    setConfirmedImport(undefined);
    previewImport.reset();
    confirmImport.reset();
  }

  const previewError =
    previewImport.error instanceof ApiError
      ? previewImport.error.message
      : previewImport.error
        ? "No se pudo conectar con el servidor"
        : null;

  const confirmError =
    confirmImport.error instanceof ApiError
      ? confirmImport.error.message
      : confirmImport.error
        ? "No se pudo conectar con el servidor"
        : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/imports")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nueva importación</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Sube un extracto en CSV o XLSX.</p>
        </div>
      </div>

      {step === "upload" && (
        <Card>
          <CardContent className="pt-6">
            <form className="flex flex-col gap-4" onSubmit={handleUploadSubmit}>
              <FormError message={previewError} />

              <div className="flex flex-col gap-1.5">
                <Label>Cuenta</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {(accounts ?? []).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-file">Fichero (CSV o XLSX, máx. 15 MB)</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0])}
                  required
                />
              </div>

              <Button type="submit" disabled={!accountId || !file || previewImport.isPending} className="self-start">
                {previewImport.isPending && <Spinner className="text-white" />}
                <FileUp className="h-4 w-4" />
                Previsualizar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <ColumnMappingForm
          headers={headers}
          isPending={previewImport.isPending}
          error={previewError}
          onCancel={resetWizard}
          onSubmit={(mapping) => runPreview(mapping)}
        />
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          <FormError message={confirmError} />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Filas" value={summary.totalRows} />
            <SummaryCard label="Nuevas" value={summary.new} tone="positive" />
            <SummaryCard label="Duplicadas" value={summary.duplicates} />
            <SummaryCard label="Con error" value={summary.errors} tone="negative" />
          </div>

          <Card>
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell className="text-[var(--color-text-muted)]">{row.rowNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.date ? formatDate(row.date) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{row.originalDescription ?? "—"}</span>
                          {row.reason && <span className="text-xs text-[var(--color-text-muted)]">{row.reason}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {row.amount !== undefined ? formatCurrency(row.amount) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.status === "new" ? "positive" : row.status === "error" ? "warning" : "neutral"}
                        >
                          {STATUS_LABELS[row.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={resetWizard}>
              Elegir otro fichero
            </Button>
            <Button onClick={handleConfirm} disabled={summary.new === 0 || confirmImport.isPending}>
              {confirmImport.isPending && <Spinner className="text-white" />}
              Confirmar importación ({summary.new} nuevos)
            </Button>
          </div>
        </div>
      )}

      {step === "done" && confirmedImport && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-[var(--color-positive)]" />
            <p className="text-lg font-medium text-slate-900">Importación completada</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {confirmedImport.importedCount} movimientos nuevos, {confirmedImport.duplicateCount} duplicados
              descartados.
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={resetWizard}>
                Importar otro fichero
              </Button>
              <Button onClick={() => navigate("/transactions")}>Ver movimientos</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "positive" | "negative" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
        <p
          className={`text-2xl font-semibold ${
            tone === "positive"
              ? "text-[var(--color-positive)]"
              : tone === "negative"
                ? "text-[var(--color-negative)]"
                : "text-slate-900"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
