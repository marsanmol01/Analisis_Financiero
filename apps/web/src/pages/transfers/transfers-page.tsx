import { useState } from "react";
import { ArrowLeftRight, Search, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Spinner } from "../../components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useAccounts } from "../../hooks/use-accounts";
import { useDetectTransfers, useTransfers, useUpdateTransferStatus } from "../../hooks/use-transfers";
import { formatCurrency, formatDate } from "../../lib/format";
import type { InternalTransfer, InternalTransferStatus } from "../../types/transfer";

const ALL_STATUS = "__all__";

const STATUS_LABELS: Record<InternalTransferStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
};

export function TransfersPage() {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUS);
  const [toleranceDays, setToleranceDays] = useState("3");
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  const status = statusFilter === ALL_STATUS ? undefined : (statusFilter as InternalTransferStatus);
  const { data: transfers, isLoading, isError } = useTransfers(status);
  const { data: accounts } = useAccounts();
  const detectTransfers = useDetectTransfers();
  const updateStatus = useUpdateTransferStatus();

  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));

  function handleDetect() {
    setDetectMessage(null);
    detectTransfers.mutate(
      { toleranceDays: Number(toleranceDays) || undefined },
      {
        onSuccess: (result) =>
          setDetectMessage(
            `Revisados ${result.evaluated} movimientos: ${result.created} pares encontrados (${result.autoConfirmed} confirmados automáticamente, ${result.pending} pendientes de revisión).`,
          ),
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Transferencias internas</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Pares de movimientos entre tus propias cuentas, para no contarlos como ingreso o gasto real.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label>Estado</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUS}>Todas</SelectItem>
                <SelectItem value="PENDING">Pendientes</SelectItem>
                <SelectItem value="CONFIRMED">Confirmadas</SelectItem>
                <SelectItem value="REJECTED">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tolerance-days">Tolerancia (días)</Label>
            <Input
              id="tolerance-days"
              type="number"
              min={0}
              max={30}
              value={toleranceDays}
              onChange={(e) => setToleranceDays(e.target.value)}
              className="w-24"
            />
          </div>

          <Button onClick={handleDetect} disabled={detectTransfers.isPending}>
            {detectTransfers.isPending ? <Spinner className="text-white" /> : <Search className="h-4 w-4" />}
            Detectar transferencias
          </Button>
        </CardContent>
      </Card>

      {detectMessage && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-positive)]/20 bg-[var(--color-positive-muted)] px-3 py-2 text-sm text-[var(--color-positive)]">
          {detectMessage}
          <button type="button" onClick={() => setDetectMessage(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando transferencias…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar las transferencias. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {transfers && transfers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ArrowLeftRight className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">
              No hay transferencias {statusFilter === ALL_STATUS ? "" : "con este estado "}todavía.
            </p>
          </CardContent>
        </Card>
      )}

      {transfers && transfers.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salida</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Confianza</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => (
                <TransferRow
                  key={transfer.id}
                  transfer={transfer}
                  accountName={(id: string) => accountsById.get(id)?.name ?? "—"}
                  onChangeStatus={(status) => updateStatus.mutate({ id: transfer.id, status })}
                  isPending={updateStatus.isPending}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function TransferRow({
  transfer,
  accountName,
  onChangeStatus,
  isPending,
}: {
  transfer: InternalTransfer;
  accountName: (accountId: string) => string;
  onChangeStatus: (status: InternalTransferStatus) => void;
  isPending: boolean;
}) {
  const amount = Math.abs(Number(transfer.outgoingTransaction.amount));
  const confidencePercent = Math.round(Number(transfer.confidence) * 100);

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="whitespace-nowrap">{formatDate(transfer.outgoingTransaction.date)}</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {accountName(transfer.outgoingTransaction.accountId)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="whitespace-nowrap">{formatDate(transfer.incomingTransaction.date)}</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {accountName(transfer.incomingTransaction.accountId)}
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right font-medium">{formatCurrency(amount)}</TableCell>
      <TableCell className="text-[var(--color-text-muted)]">{confidencePercent}%</TableCell>
      <TableCell>
        <Badge
          variant={transfer.status === "CONFIRMED" ? "positive" : transfer.status === "REJECTED" ? "warning" : "neutral"}
        >
          {STATUS_LABELS[transfer.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {transfer.status !== "CONFIRMED" && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => onChangeStatus("CONFIRMED")}>
              Confirmar
            </Button>
          )}
          {transfer.status !== "REJECTED" && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => onChangeStatus("REJECTED")}>
              Rechazar
            </Button>
          )}
          {transfer.status !== "PENDING" && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => onChangeStatus("PENDING")}>
              Deshacer
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
