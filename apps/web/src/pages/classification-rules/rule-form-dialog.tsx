import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useAccounts } from "../../hooks/use-accounts";
import { useCategories } from "../../hooks/use-categories";
import { useCreateRule, useUpdateRule } from "../../hooks/use-classification-rules";
import { RULE_OPERATOR_OPTIONS } from "../../lib/rule-operators";
import { ApiError } from "../../lib/api-client";
import type { ClassificationRule, RuleOperator } from "../../types/classification-rule";

const ALL_ACCOUNTS = "__all__";

export function RuleFormDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ClassificationRule;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <RuleForm rule={rule} onOpenChange={onOpenChange} />}</DialogContent>
    </Dialog>
  );
}

function RuleForm({ rule, onOpenChange }: { rule?: ClassificationRule; onOpenChange: (open: boolean) => void }) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const [operator, setOperator] = useState<RuleOperator>(rule?.operator ?? "CONTAINS");
  const [value, setValue] = useState(rule?.value ?? "");
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [accountId, setAccountId] = useState(rule?.accountId ?? ALL_ACCOUNTS);
  const [minAmount, setMinAmount] = useState(rule?.minAmount ?? "");
  const [maxAmount, setMaxAmount] = useState(rule?.maxAmount ?? "");
  const [priority, setPriority] = useState(String(rule?.priority ?? 100));
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);

  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const isEditing = Boolean(rule);
  const mutation = isEditing ? updateRule : createRule;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = {
      operator,
      value,
      categoryId,
      accountId: accountId === ALL_ACCOUNTS ? undefined : accountId,
      minAmount: minAmount === "" ? undefined : Number(minAmount),
      maxAmount: maxAmount === "" ? undefined : Number(maxAmount),
      priority: Number(priority),
      isActive,
    };
    const onSuccess = () => onOpenChange(false);
    if (rule) {
      updateRule.mutate({ id: rule.id, input }, { onSuccess });
    } else {
      createRule.mutate(input, { onSuccess });
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
        <DialogTitle>{isEditing ? "Editar regla" : "Nueva regla de clasificación"}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Operador</Label>
            <Select value={operator} onValueChange={(v) => setOperator(v as RuleOperator)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_OPERATOR_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-value">Valor</Label>
            <Input id="rule-value" required maxLength={200} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-[var(--color-text-muted)]">
          Se compara contra la descripción del movimiento en mayúsculas (p. ej. "MERCADONA").
        </p>

        <div className="flex flex-col gap-1.5">
          <Label>Categoría a asignar</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una categoría" />
            </SelectTrigger>
            <SelectContent>
              {(categories ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Cuenta (opcional)</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
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

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-min-amount">Importe mínimo (opcional)</Label>
            <Input
              id="rule-min-amount"
              type="number"
              step="0.01"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-max-amount">Importe máximo (opcional)</Label>
            <Input
              id="rule-max-amount"
              type="number"
              step="0.01"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-[var(--color-text-muted)]">
          Los gastos son importes negativos: p. ej. de -100 a -1 para gastos entre 1 € y 100 €.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rule-priority">Prioridad</Label>
          <Input
            id="rule-priority"
            type="number"
            step="1"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-32"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Se evalúan de menor a mayor: un número más bajo gana si varias reglas coinciden.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[var(--color-border)]"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Regla activa
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !categoryId}>
            {mutation.isPending && <Spinner className="text-white" />}
            {isEditing ? "Guardar cambios" : "Crear regla"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
