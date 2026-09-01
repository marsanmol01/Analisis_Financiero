import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ACCOUNT_TYPE_OPTIONS } from "../../lib/account-types";
import { useCreateAccount, useUpdateAccount } from "../../hooks/use-accounts";
import { ApiError } from "../../lib/api-client";
import type { Account, AccountType } from "../../types/account";

interface FormState {
  name: string;
  entity: string;
  alias: string;
  type: AccountType;
  balance: string;
  isActive: boolean;
  ibanMask: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  entity: "",
  alias: "",
  type: "CHECKING",
  balance: "0",
  isActive: true,
  ibanMask: "",
  notes: "",
};

function toFormState(account: Account): FormState {
  return {
    name: account.name,
    entity: account.entity ?? "",
    alias: account.alias ?? "",
    type: account.type,
    balance: account.balance,
    isActive: account.isActive,
    ibanMask: account.ibanMask ?? "",
    notes: account.notes ?? "",
  };
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {/* Se desmonta al cerrar el dialogo, asi cada apertura arranca con estado limpio sin
            necesidad de un efecto que sincronice el formulario con la cuenta a editar. */}
        {open && <AccountForm account={account} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function AccountForm({ account, onOpenChange }: { account?: Account; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<FormState>(() => (account ? toFormState(account) : EMPTY_FORM));
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const isEditing = Boolean(account);
  const mutation = isEditing ? updateAccount : createAccount;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = {
      name: form.name,
      entity: form.entity || undefined,
      alias: form.alias || undefined,
      type: form.type,
      balance: Number(form.balance),
      isActive: form.isActive,
      ibanMask: form.ibanMask || undefined,
      notes: form.notes || undefined,
    };

    const onSuccess = () => onOpenChange(false);
    if (account) {
      updateAccount.mutate({ id: account.id, input }, { onSuccess });
    } else {
      createAccount.mutate(input, { onSuccess });
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
        <DialogTitle>{isEditing ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-name">Nombre</Label>
          <Input
            id="account-name"
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-entity">Entidad</Label>
            <Input
              id="account-entity"
              maxLength={120}
              value={form.entity}
              onChange={(e) => setForm((f) => ({ ...f, entity: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-alias">Alias</Label>
            <Input
              id="account-alias"
              maxLength={120}
              value={form.alias}
              onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(value) => setForm((f) => ({ ...f, type: value as AccountType }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-balance">Saldo actual (€)</Label>
            <Input
              id="account-balance"
              type="number"
              step="0.01"
              required
              value={form.balance}
              onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-iban">Identificador enmascarado (opcional)</Label>
          <Input
            id="account-iban"
            maxLength={34}
            placeholder="ES91 **** **** **** 1234"
            value={form.ibanMask}
            onChange={(e) => setForm((f) => ({ ...f, ibanMask: e.target.value }))}
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Nunca introduzcas un IBAN o número de cuenta completo: solo un identificador enmascarado a modo de
            referencia visual.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-notes">Notas</Label>
          <Textarea
            id="account-notes"
            maxLength={2000}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[var(--color-border)]"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Cuenta activa
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="text-white" />}
            {isEditing ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
