import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useCategories } from "../../hooks/use-categories";
import { useCreateBudget, useUpdateBudget } from "../../hooks/use-budgets";
import { ApiError } from "../../lib/api-client";
import type { Budget } from "../../types/budget";

const GENERAL_BUDGET = "__general__";

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <BudgetForm budget={budget} onOpenChange={onOpenChange} />}</DialogContent>
    </Dialog>
  );
}

function BudgetForm({ budget, onOpenChange }: { budget?: Budget; onOpenChange: (open: boolean) => void }) {
  const { data: categories } = useCategories();
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? GENERAL_BUDGET);
  const [amount, setAmount] = useState(budget?.amount ?? "");
  const [isActive, setIsActive] = useState(budget?.isActive ?? true);
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const isEditing = Boolean(budget);
  const mutation = isEditing ? updateBudget : createBudget;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const onSuccess = () => onOpenChange(false);
    if (budget) {
      updateBudget.mutate({ id: budget.id, input: { amount: Number(amount), isActive } }, { onSuccess });
    } else {
      createBudget.mutate(
        { categoryId: categoryId === GENERAL_BUDGET ? undefined : categoryId, amount: Number(amount) },
        { onSuccess },
      );
    }
  }

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "No se pudo conectar con el servidor"
        : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Editar presupuesto" : "Nuevo presupuesto"}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <div className="flex flex-col gap-1.5">
          <Label>Categoría</Label>
          {isEditing ? (
            <p className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-slate-700">
              {budget?.category?.name ?? "Presupuesto general (todo el gasto)"}
            </p>
          ) : (
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_BUDGET}>General (todo el gasto del mes)</SelectItem>
                {(categories ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-amount">Importe mensual (€)</Label>
          <Input
            id="budget-amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {isEditing && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--color-border)]"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Presupuesto activo
          </label>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="text-white" />}
            {isEditing ? "Guardar cambios" : "Crear presupuesto"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
