import { useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import type { ColumnMapping } from "../../types/import";

const NONE = "__none__";

function ColumnSelect({
  label,
  value,
  onChange,
  headers,
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  headers: string[];
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Sin usar" />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value={NONE}>— Sin usar —</SelectItem>}
          {headers.map((header, index) => (
            <SelectItem key={index} value={String(index)}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ColumnMappingForm({
  headers,
  isPending,
  error,
  onCancel,
  onSubmit,
}: {
  headers: string[];
  isPending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (mapping: ColumnMapping) => void;
}) {
  const [dateCol, setDateCol] = useState("");
  const [descriptionCol, setDescriptionCol] = useState("");
  const [amountMode, setAmountMode] = useState<"single" | "split">("single");
  const [amountCol, setAmountCol] = useState("");
  const [debitCol, setDebitCol] = useState("");
  const [creditCol, setCreditCol] = useState("");
  const [valueDateCol, setValueDateCol] = useState(NONE);
  const [referenceCol, setReferenceCol] = useState(NONE);
  const [currencyCol, setCurrencyCol] = useState(NONE);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setValidationError(null);

    if (!dateCol || !descriptionCol) {
      setValidationError("Indica al menos las columnas de fecha y descripción.");
      return;
    }
    if (amountMode === "single" && !amountCol) {
      setValidationError("Indica la columna de importe.");
      return;
    }
    if (amountMode === "split" && (!debitCol || !creditCol)) {
      setValidationError("Indica las columnas de debe y haber.");
      return;
    }

    const mapping: ColumnMapping = {
      date: Number(dateCol),
      description: Number(descriptionCol),
      ...(amountMode === "single" ? { amount: Number(amountCol) } : { debit: Number(debitCol), credit: Number(creditCol) }),
      ...(valueDateCol !== NONE && { valueDate: Number(valueDateCol) }),
      ...(referenceCol !== NONE && { reference: Number(referenceCol) }),
      ...(currencyCol !== NONE && { currency: Number(currencyCol) }),
    };
    onSubmit(mapping);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>No se pudo detectar el formato automáticamente</CardTitle>
        <CardDescription>
          Indica qué columna de tu fichero corresponde a cada dato. Solo hace falta hacerlo una vez por formato de
          extracto.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FormError message={error ?? validationError} />

          <div className="grid grid-cols-2 gap-4">
            <ColumnSelect label="Fecha" value={dateCol} onChange={setDateCol} headers={headers} />
            <ColumnSelect label="Descripción" value={descriptionCol} onChange={setDescriptionCol} headers={headers} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Importe</Label>
            <div className="flex gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="amount-mode"
                  checked={amountMode === "single"}
                  onChange={() => setAmountMode("single")}
                />
                Una columna de importe
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="amount-mode"
                  checked={amountMode === "split"}
                  onChange={() => setAmountMode("split")}
                />
                Columnas separadas de debe/haber
              </label>
            </div>
            {amountMode === "single" ? (
              <ColumnSelect label="Columna de importe" value={amountCol} onChange={setAmountCol} headers={headers} />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <ColumnSelect label="Debe (cargos)" value={debitCol} onChange={setDebitCol} headers={headers} />
                <ColumnSelect label="Haber (abonos)" value={creditCol} onChange={setCreditCol} headers={headers} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <ColumnSelect
              label="Fecha valor (opcional)"
              value={valueDateCol}
              onChange={setValueDateCol}
              headers={headers}
              optional
            />
            <ColumnSelect
              label="Referencia (opcional)"
              value={referenceCol}
              onChange={setReferenceCol}
              headers={headers}
              optional
            />
            <ColumnSelect
              label="Moneda (opcional)"
              value={currencyCol}
              onChange={setCurrencyCol}
              headers={headers}
              optional
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner className="text-white" />}
              Previsualizar con este mapeo
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
