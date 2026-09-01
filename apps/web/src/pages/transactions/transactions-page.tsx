import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Receipt, Trash2, X } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Spinner } from "../../components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useDeleteTransaction, useTransactions } from "../../hooks/use-transactions";
import { useAccounts } from "../../hooks/use-accounts";
import { useCategories } from "../../hooks/use-categories";
import { useMerchants } from "../../hooks/use-merchants";
import { formatCurrency, formatDate } from "../../lib/format";
import type { Transaction, UpdateTransactionResult } from "../../types/transaction";
import { TransactionEditDialog } from "./transaction-edit-dialog";

const ALL_ACCOUNTS = "__all__";
const PAGE_SIZE = 50;

export function TransactionsPage() {
  const [accountId, setAccountId] = useState(ALL_ACCOUNTS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | undefined>(undefined);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      accountId: accountId === ALL_ACCOUNTS ? undefined : accountId,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [accountId, from, to, page],
  );

  const { data, isLoading, isError, isPlaceholderData } = useTransactions(filters);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: merchants } = useMerchants();
  const deleteTransaction = useDeleteTransaction();

  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const merchantsById = useMemo(() => new Map((merchants ?? []).map((m) => [m.id, m])), [merchants]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function resetFilters() {
    setAccountId(ALL_ACCOUNTS);
    setFrom("");
    setTo("");
    setPage(1);
  }

  function handleUpdated(result: UpdateTransactionResult) {
    const parts: string[] = [];
    if (result.similarUpdatedCount) {
      parts.push(`Se actualizaron ${result.similarUpdatedCount} movimientos similares.`);
    }
    if (result.ruleCreated) {
      parts.push("Se creó una regla de clasificación automática.");
    }
    setLastActionMessage(parts.length > 0 ? parts.join(" ") : null);
  }

  function confirmDelete() {
    if (!deletingTransaction) return;
    deleteTransaction.mutate(deletingTransaction.id, { onSuccess: () => setDeletingTransaction(undefined) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Transacciones</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Movimientos importados de tus cuentas.</p>
      </div>

      {lastActionMessage && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-positive)]/20 bg-[var(--color-positive-muted)] px-3 py-2 text-sm text-[var(--color-positive)]">
          {lastActionMessage}
          <button type="button" onClick={() => setLastActionMessage(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label>Cuenta</Label>
            <Select
              value={accountId}
              onValueChange={(value) => {
                setAccountId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ACCOUNTS}>Todas las cuentas</SelectItem>
                {(accounts ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-from">Desde</Label>
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-to">Hasta</Label>
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Button variant="ghost" onClick={resetFilters}>
            Limpiar filtros
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando movimientos…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar los movimientos. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {data && data.items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Receipt className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">
              No hay movimientos que coincidan con estos filtros.
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <Card className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((transaction) => {
                const amount = Number(transaction.amount);
                const category = transaction.categoryId ? categoriesById.get(transaction.categoryId) : undefined;
                const merchant = transaction.merchantId ? merchantsById.get(transaction.merchantId) : undefined;
                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap text-[var(--color-text-muted)]">
                      {formatDate(transaction.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{transaction.originalDescription}</span>
                        <div className="flex gap-1.5">
                          {merchant && <span className="text-xs text-[var(--color-text-muted)]">{merchant.name}</span>}
                          {transaction.isInternalTransfer && (
                            <Badge variant="neutral">Transferencia interna</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[var(--color-text-muted)]">
                      {accountsById.get(transaction.accountId)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {category ? <Badge variant="brand">{category.name}</Badge> : <Badge variant="neutral">Sin categoría</Badge>}
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap text-right font-medium ${
                        amount >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
                      }`}
                    >
                      {formatCurrency(amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingTransaction(transaction)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingTransaction(transaction)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
          <span>{data.total} movimientos</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span>
              Página {data.page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPlaceholderData}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <TransactionEditDialog
        open={Boolean(editingTransaction)}
        onOpenChange={(open) => !open && setEditingTransaction(undefined)}
        transaction={editingTransaction}
        onUpdated={handleUpdated}
      />

      <ConfirmDialog
        open={Boolean(deletingTransaction)}
        onOpenChange={(open) => !open && setDeletingTransaction(undefined)}
        title="Eliminar movimiento"
        description="Se eliminará este movimiento de tus listados y estadísticas."
        isPending={deleteTransaction.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
