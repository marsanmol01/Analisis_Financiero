import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useUpdateTransaction } from "../../hooks/use-transactions";
import { useCategories } from "../../hooks/use-categories";
import { ApiError } from "../../lib/api-client";
import type { Transaction, UpdateTransactionResult } from "../../types/transaction";

const NO_CATEGORY = "__none__";

export function TransactionEditDialog({
  open,
  onOpenChange,
  transaction,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction;
  onUpdated: (result: UpdateTransactionResult) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && transaction && (
          <TransactionEditForm transaction={transaction} onOpenChange={onOpenChange} onUpdated={onUpdated} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionEditForm({
  transaction,
  onOpenChange,
  onUpdated,
}: {
  transaction: Transaction;
  onOpenChange: (open: boolean) => void;
  onUpdated: (result: UpdateTransactionResult) => void;
}) {
  const { data: categories } = useCategories();
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? NO_CATEGORY);
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [createRule, setCreateRule] = useState(false);
  const updateTransaction = useUpdateTransaction();

  const categoryChanged = categoryId !== (transaction.categoryId ?? NO_CATEGORY);
  const hasCategory = categoryId !== NO_CATEGORY;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    updateTransaction.mutate(
      {
        id: transaction.id,
        input: {
          categoryId: categoryId === NO_CATEGORY ? null : categoryId,
          notes,
          applyToSimilar: hasCategory && categoryChanged ? applyToSimilar : undefined,
          createRule: hasCategory && categoryChanged ? createRule : undefined,
        },
      },
      {
        onSuccess: (result) => {
          onUpdated(result);
          onOpenChange(false);
        },
      },
    );
  }

  const errorMessage =
    updateTransaction.error instanceof ApiError
      ? updateTransaction.error.message
      : updateTransaction.error
        ? "No se pudo conectar con el servidor"
        : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar movimiento</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <p className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-slate-700">
          {transaction.originalDescription}
        </p>

        <div className="flex flex-col gap-1.5">
          <Label>Categoría</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
              {(categories ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transaction-notes">Notas</Label>
          <Textarea
            id="transaction-notes"
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {hasCategory && categoryChanged && (
          <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              Puedes usar esta corrección para enseñar al sistema a clasificar movimientos parecidos.
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--color-border)]"
                checked={applyToSimilar}
                onChange={(e) => setApplyToSimilar(e.target.checked)}
              />
              Aplicar la misma categoría a movimientos similares sin categorizar a mano
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--color-border)]"
                checked={createRule}
                onChange={(e) => setCreateRule(e.target.checked)}
              />
              Crear una regla de clasificación automática a partir de esta descripción
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={updateTransaction.isPending}>
            {updateTransaction.isPending && <Spinner className="text-white" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
