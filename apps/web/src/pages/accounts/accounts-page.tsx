import { useState } from "react";
import { Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useAccounts, useDeleteAccount } from "../../hooks/use-accounts";
import { ACCOUNT_TYPE_LABELS } from "../../lib/account-types";
import { formatCurrency } from "../../lib/format";
import type { Account } from "../../types/account";
import { AccountFormDialog } from "./account-form-dialog";

export function AccountsPage() {
  const { data: accounts, isLoading, isError } = useAccounts();
  const deleteAccount = useDeleteAccount();

  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
  const [deletingAccount, setDeletingAccount] = useState<Account | undefined>(undefined);

  function openCreate() {
    setEditingAccount(undefined);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditingAccount(account);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deletingAccount) return;
    deleteAccount.mutate(deletingAccount.id, { onSuccess: () => setDeletingAccount(undefined) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cuentas</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Cuentas bancarias, tarjetas y monederos que quieres seguir.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando cuentas…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar las cuentas. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {accounts && accounts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <WalletCards className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no has añadido ninguna cuenta.</p>
            <Button variant="outline" onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Añadir la primera
            </Button>
          </CardContent>
        </Card>
      )}

      {accounts && accounts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{account.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {account.entity || ACCOUNT_TYPE_LABELS[account.type]}
                    </p>
                  </div>
                  {!account.isActive && <Badge variant="warning">Inactiva</Badge>}
                </div>

                <p className="text-xl font-semibold text-slate-900">{formatCurrency(Number(account.balance))}</p>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="brand">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                  {account.ibanMask && <Badge variant="neutral">{account.ibanMask}</Badge>}
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeletingAccount(account)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AccountFormDialog open={formOpen} onOpenChange={setFormOpen} account={editingAccount} />

      <ConfirmDialog
        open={Boolean(deletingAccount)}
        onOpenChange={(open) => !open && setDeletingAccount(undefined)}
        title="Eliminar cuenta"
        description={`Se eliminará "${deletingAccount?.name}". Su historial de movimientos se conserva, pero la cuenta dejará de aparecer en tus listados.`}
        isPending={deleteAccount.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
