import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useCategories } from "../../hooks/use-categories";
import { useCreateMerchant, useUpdateMerchant } from "../../hooks/use-merchants";
import { ApiError } from "../../lib/api-client";
import type { Merchant } from "../../types/merchant";

const NO_CATEGORY = "__none__";

export function MerchantFormDialog({
  open,
  onOpenChange,
  merchant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchant?: Merchant;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <MerchantForm merchant={merchant} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function MerchantForm({ merchant, onOpenChange }: { merchant?: Merchant; onOpenChange: (open: boolean) => void }) {
  const { data: categories } = useCategories();
  const [name, setName] = useState(merchant?.name ?? "");
  const [defaultCategoryId, setDefaultCategoryId] = useState(merchant?.defaultCategoryId ?? NO_CATEGORY);
  const createMerchant = useCreateMerchant();
  const updateMerchant = useUpdateMerchant();
  const isEditing = Boolean(merchant);
  const mutation = isEditing ? updateMerchant : createMerchant;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { name, defaultCategoryId: defaultCategoryId === NO_CATEGORY ? undefined : defaultCategoryId };
    const onSuccess = () => onOpenChange(false);
    if (merchant) {
      updateMerchant.mutate({ id: merchant.id, input }, { onSuccess });
    } else {
      createMerchant.mutate(input, { onSuccess });
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
        <DialogTitle>{isEditing ? "Editar comercio" : "Nuevo comercio"}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="merchant-name">Nombre</Label>
          <Input id="merchant-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Categoría por defecto (opcional)</Label>
          <Select value={defaultCategoryId} onValueChange={setDefaultCategoryId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Sin categoría por defecto</SelectItem>
              {(categories ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[var(--color-text-muted)]">
            Se usará para clasificar automáticamente los movimientos de este comercio cuando ninguna regla aplique
            antes.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="text-white" />}
            {isEditing ? "Guardar cambios" : "Crear comercio"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
