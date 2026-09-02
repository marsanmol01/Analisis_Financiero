import { useState } from "react";
import { PiggyBank, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Spinner } from "../../components/ui/spinner";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useBudgets, useBudgetsProgress, useDeleteBudget } from "../../hooks/use-budgets";
import { formatCurrency } from "../../lib/format";
import type { Budget } from "../../types/budget";
import { BudgetFormDialog } from "./budget-form-dialog";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data: budgets, isLoading, isError } = useBudgets();
  const { data: progress } = useBudgetsProgress(month);
  const deleteBudget = useDeleteBudget();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);
  const [deletingBudget, setDeletingBudget] = useState<Budget | undefined>(undefined);

  const progressById = new Map((progress ?? []).map((p) => [p.id, p]));

  function openCreate() {
    setEditingBudget(undefined);
    setFormOpen(true);
  }

  function openEdit(budget: Budget) {
    setEditingBudget(budget);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deletingBudget) return;
    deleteBudget.mutate(deletingBudget.id, { onSuccess: () => setDeletingBudget(undefined) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Presupuestos</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Límites de gasto mensuales, generales o por categoría.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="progress-month">Mes</Label>
            <Input
              id="progress-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo presupuesto
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando presupuestos…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar los presupuestos. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {budgets && budgets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <PiggyBank className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no has creado ningún presupuesto.</p>
            <Button variant="outline" onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Crear el primero
            </Button>
          </CardContent>
        </Card>
      )}

      {budgets && budgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const p = progressById.get(budget.id);
            return (
              <Card key={budget.id}>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{budget.category?.name ?? "Presupuesto general"}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{formatCurrency(Number(budget.amount))} / mes</p>
                    </div>
                    {!budget.isActive && <Badge variant="warning">Inactivo</Badge>}
                  </div>

                  {p ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{formatCurrency(p.spent)} gastados</span>
                        <span className="text-[var(--color-text-muted)]">{p.percentageConsumed}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)]">
                        <div
                          className={`h-2 rounded-full ${
                            p.alertLevel === 100
                              ? "bg-[var(--color-negative)]"
                              : p.alertLevel && p.alertLevel >= 90
                                ? "bg-[var(--color-warning)]"
                                : "bg-[var(--color-brand-500)]"
                          }`}
                          style={{ width: `${Math.min(100, p.percentageConsumed)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {p.remaining >= 0
                          ? `Quedan ${formatCurrency(p.remaining)}`
                          : `Superado en ${formatCurrency(Math.abs(p.remaining))}`}
                        {p.projection !== null && ` · proyección fin de mes: ${formatCurrency(p.projection)}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Sin datos de progreso para este mes{!budget.isActive ? " (inactivo)" : ""}.
                    </p>
                  )}

                  <div className="mt-1 flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(budget)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeletingBudget(budget)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetFormDialog open={formOpen} onOpenChange={setFormOpen} budget={editingBudget} />

      <ConfirmDialog
        open={Boolean(deletingBudget)}
        onOpenChange={(open) => !open && setDeletingBudget(undefined)}
        title="Eliminar presupuesto"
        description="Dejará de seguirse. Los movimientos ya registrados no cambian."
        isPending={deleteBudget.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
