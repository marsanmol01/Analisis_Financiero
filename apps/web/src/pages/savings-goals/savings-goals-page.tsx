import { useState } from "react";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useAccounts } from "../../hooks/use-accounts";
import { useDeleteSavingsGoal, useSavingsGoals } from "../../hooks/use-savings-goals";
import { formatCurrency, formatDate } from "../../lib/format";
import type { SavingsGoal } from "../../types/savings-goal";
import { SavingsGoalFormDialog } from "./savings-goal-form-dialog";

const STATUS_LABELS: Record<SavingsGoal["status"], string> = {
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  ABANDONED: "Abandonado",
};

export function SavingsGoalsPage() {
  const { data: goals, isLoading, isError } = useSavingsGoals();
  const { data: accounts } = useAccounts();
  const deleteGoal = useDeleteSavingsGoal();

  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | undefined>(undefined);
  const [deletingGoal, setDeletingGoal] = useState<SavingsGoal | undefined>(undefined);

  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));

  function openCreate() {
    setEditingGoal(undefined);
    setFormOpen(true);
  }

  function openEdit(goal: SavingsGoal) {
    setEditingGoal(goal);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deletingGoal) return;
    deleteGoal.mutate(deletingGoal.id, { onSuccess: () => setDeletingGoal(undefined) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Objetivos de ahorro</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Metas de ahorro con seguimiento manual o automático a partir del saldo de una cuenta.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo objetivo
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando objetivos…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar los objetivos. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {goals && goals.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Target className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no has creado ningún objetivo.</p>
            <Button variant="outline" onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Crear el primero
            </Button>
          </CardContent>
        </Card>
      )}

      {goals && goals.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{goal.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {goal.accountId
                        ? `Automático: ${accountsById.get(goal.accountId)?.name ?? "cuenta"}`
                        : "Seguimiento manual"}
                    </p>
                  </div>
                  <Badge variant={goal.status === "ACTIVE" ? "brand" : "neutral"}>{STATUS_LABELS[goal.status]}</Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {formatCurrency(goal.progress.savedSoFar)} / {formatCurrency(Number(goal.targetAmount))}
                  </span>
                  <span className="text-[var(--color-text-muted)]">{goal.progress.progressPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)]">
                  <div
                    className="h-2 rounded-full bg-[var(--color-brand-500)]"
                    style={{ width: `${Math.min(100, Math.max(0, goal.progress.progressPercent))}%` }}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {goal.status === "ACTIVE" && (
                    <Badge variant={goal.progress.isOnTrack ? "positive" : "warning"}>
                      {goal.progress.isOnTrack ? "Al ritmo previsto" : "Por detrás del ritmo"}
                    </Badge>
                  )}
                  {goal.progress.isComplete && <Badge variant="positive">Completado</Badge>}
                </div>

                <p className="text-xs text-[var(--color-text-muted)]">
                  Fecha límite: {formatDate(goal.targetDate)}
                  {goal.progress.monthlyContributionNeeded !== null &&
                    ` · aportación mensual necesaria: ${formatCurrency(goal.progress.monthlyContributionNeeded)}`}
                </p>

                <div className="mt-1 flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(goal)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeletingGoal(goal)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SavingsGoalFormDialog open={formOpen} onOpenChange={setFormOpen} goal={editingGoal} />

      <ConfirmDialog
        open={Boolean(deletingGoal)}
        onOpenChange={(open) => !open && setDeletingGoal(undefined)}
        title="Eliminar objetivo"
        description={`Se eliminará "${deletingGoal?.name}" y su progreso.`}
        isPending={deleteGoal.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
