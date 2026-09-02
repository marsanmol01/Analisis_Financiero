import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useAccounts } from "../../hooks/use-accounts";
import { useTransactions } from "../../hooks/use-transactions";
import { useCreateManualRecurring } from "../../hooks/use-recurring";
import { ApiError } from "../../lib/api-client";
import { formatCurrency, formatDate } from "../../lib/format";

export function ManualRecurringDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {open && <ManualRecurringForm onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function ManualRecurringForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { data: accounts } = useAccounts();
  const [accountId, setAccountId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const createManual = useCreateManualRecurring();

  const { data: transactionsPage, isLoading } = useTransactions(
    { accountId, pageSize: 100 },
    { enabled: Boolean(accountId) },
  );
  const transactions = transactionsPage?.items ?? [];

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAccountChange(value: string) {
    setAccountId(value);
    setSelectedIds(new Set());
  }

  function handleSubmit() {
    createManual.mutate([...selectedIds], { onSuccess: () => onOpenChange(false) });
  }

  const errorMessage =
    createManual.error instanceof ApiError
      ? createManual.error.message
      : createManual.error
        ? "No se pudo conectar con el servidor"
        : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Crear grupo recurrente manualmente</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <FormError message={errorMessage} />

        <div className="flex flex-col gap-1.5">
          <Label>Cuenta</Label>
          <Select value={accountId} onValueChange={handleAccountChange}>
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

        {accountId && (
          <div className="flex flex-col gap-1.5">
            <Label>Movimientos (elige al menos 2, del mismo signo)</Label>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <Spinner /> Cargando movimientos…
              </div>
            )}
            {!isLoading && transactions.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">Esta cuenta no tiene movimientos.</p>
            )}
            <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)]">
              {transactions.map((transaction) => (
                <label
                  key={transaction.id}
                  className="flex cursor-pointer items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-sm last:border-b-0 hover:bg-[var(--color-surface-muted)]"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--color-border)]"
                    checked={selectedIds.has(transaction.id)}
                    onChange={() => toggle(transaction.id)}
                  />
                  <span className="whitespace-nowrap text-[var(--color-text-muted)]">
                    {formatDate(transaction.date)}
                  </span>
                  <span className="flex-1 truncate">{transaction.originalDescription}</span>
                  <span className="whitespace-nowrap font-medium">{formatCurrency(Number(transaction.amount))}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={selectedIds.size < 2 || createManual.isPending}
          >
            {createManual.isPending && <Spinner className="text-white" />}
            Crear grupo ({selectedIds.size} seleccionados)
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}
