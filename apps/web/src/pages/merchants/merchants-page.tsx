import { useState } from "react";
import { Plus, Store } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useCategories } from "../../hooks/use-categories";
import { useDeleteMerchant, useMerchants } from "../../hooks/use-merchants";
import type { Merchant } from "../../types/merchant";
import { MerchantCard } from "./merchant-card";
import { MerchantFormDialog } from "./merchant-form-dialog";

export function MerchantsPage() {
  const { data: merchants, isLoading, isError } = useMerchants();
  const { data: categories } = useCategories();
  const deleteMerchant = useDeleteMerchant();

  const [formOpen, setFormOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | undefined>(undefined);
  const [deletingMerchant, setDeletingMerchant] = useState<Merchant | undefined>(undefined);

  const categoriesById = new Map((categories ?? []).map((c) => [c.id, c]));

  function openCreate() {
    setEditingMerchant(undefined);
    setFormOpen(true);
  }

  function openEdit(merchant: Merchant) {
    setEditingMerchant(merchant);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deletingMerchant) return;
    deleteMerchant.mutate(deletingMerchant.id, { onSuccess: () => setDeletingMerchant(undefined) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Comercios</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Agrupa movimientos del mismo comercio y asígnales una categoría por defecto.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo comercio
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando comercios…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar los comercios. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {merchants && merchants.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Store className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no has añadido ningún comercio.</p>
            <Button variant="outline" onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Añadir el primero
            </Button>
          </CardContent>
        </Card>
      )}

      {merchants && merchants.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {merchants.map((merchant) => (
            <MerchantCard
              key={merchant.id}
              merchant={merchant}
              defaultCategory={merchant.defaultCategoryId ? categoriesById.get(merchant.defaultCategoryId) : undefined}
              onEdit={openEdit}
              onDelete={setDeletingMerchant}
            />
          ))}
        </div>
      )}

      <MerchantFormDialog open={formOpen} onOpenChange={setFormOpen} merchant={editingMerchant} />

      <ConfirmDialog
        open={Boolean(deletingMerchant)}
        onOpenChange={(open) => !open && setDeletingMerchant(undefined)}
        title="Eliminar comercio"
        description={`Se eliminará "${deletingMerchant?.name}" y sus alias. Los movimientos ya clasificados con este comercio se quedarán sin comercio asignado.`}
        isPending={deleteMerchant.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
