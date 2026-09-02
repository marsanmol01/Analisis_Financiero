import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useAccounts } from "../../hooks/use-accounts";
import { useCreateSavingsGoal, useUpdateSavingsGoal } from "../../hooks/use-savings-goals";
import { ApiError } from "../../lib/api-client";
import type { SavingsGoal, SavingsGoalStatus } from "../../types/savings-goal";

const NO_ACCOUNT = "__manual__";

const STATUS_OPTIONS: { value: SavingsGoalStatus; label: string }[] = [
  { value: "ACTIVE", label: "Activo" },
  { value: "COMPLETED", label: "Completado" },
  { value: "ABANDONED", label: "Abandonado" },
];

function toDateInput(value: string): string {
  return value.slice(0, 10);
}

export function SavingsGoalFormDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: SavingsGoal;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {open && <SavingsGoalForm goal={goal} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function SavingsGoalForm({ goal, onOpenChange }: { goal?: SavingsGoal; onOpenChange: (open: boolean) => void }) {
  const { data: accounts } = useAccounts();
  const [name, setName] = useState(goal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount ?? "");
  const [initialAmount, setInitialAmount] = useState(goal?.initialAmount ?? "0");
  const [startDate, setStartDate] = useState(goal ? toDateInput(goal.startDate) : "");
  const [targetDate, setTargetDate] = useState(goal ? toDateInput(goal.targetDate) : "");
  const [accountId, setAccountId] = useState(goal?.accountId ?? NO_ACCOUNT);
  const [currentAmount, setCurrentAmount] = useState(goal?.currentAmount ?? "0");
  const [status, setStatus] = useState<SavingsGoalStatus>(goal?.status ?? "ACTIVE");

  const createGoal = useCreateSavingsGoal();
  const updateGoal = useUpdateSavingsGoal();
  const isEditing = Boolean(goal);
  const mutation = isEditing ? updateGoal : createGoal;
  const isLinkedToAccount = accountId !== NO_ACCOUNT;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const onSuccess = () => onOpenChange(false);

    if (goal) {
      updateGoal.mutate(
        {
          id: goal.id,
          input: {
            name,
            targetAmount: Number(targetAmount),
            targetDate,
            accountId: accountId === NO_ACCOUNT ? null : accountId,
            currentAmount: isLinkedToAccount ? undefined : Number(currentAmount),
            status,
          },
        },
        { onSuccess },
      );
    } else {
      createGoal.mutate(
        {
          name,
          targetAmount: Number(targetAmount),
          initialAmount: Number(initialAmount),
          startDate: startDate || undefined,
          targetDate,
          accountId: accountId === NO_ACCOUNT ? undefined : accountId,
        },
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
        <DialogTitle>{isEditing ? "Editar objetivo" : "Nuevo objetivo de ahorro"}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-name">Nombre</Label>
          <Input id="goal-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-target-amount">Importe objetivo (€)</Label>
            <Input
              id="goal-target-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>
          {!isEditing && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-initial-amount">Importe inicial (€)</Label>
              <Input
                id="goal-initial-amount"
                type="number"
                step="0.01"
                min="0"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isEditing && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-start-date">Fecha inicial (opcional)</Label>
              <Input id="goal-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-target-date">Fecha límite</Label>
            <Input
              id="goal-target-date"
              type="date"
              required
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Seguimiento del progreso</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ACCOUNT}>Manual (yo actualizo el importe ahorrado)</SelectItem>
              {(accounts ?? []).map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  Automático: saldo de "{account.name}"
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isEditing && !isLinkedToAccount && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-current-amount">Importe ahorrado hasta ahora (€)</Label>
            <Input
              id="goal-current-amount"
              type="number"
              step="0.01"
              min="0"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
            />
          </div>
        )}

        {isEditing && (
          <div className="flex flex-col gap-1.5">
            <Label>Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SavingsGoalStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="text-white" />}
            {isEditing ? "Guardar cambios" : "Crear objetivo"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
