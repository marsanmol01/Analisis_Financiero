import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useCategories } from "../../hooks/use-categories";
import { useUpdateRecurring } from "../../hooks/use-recurring";
import { ApiError } from "../../lib/api-client";
import type { RecurringGroup } from "../../types/recurring";

const NO_CATEGORY = "__none__";

export function RecurringEditDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: RecurringGroup;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && group && <RecurringEditForm group={group} onOpenChange={onOpenChange} />}</DialogContent>
    </Dialog>
  );
}

function RecurringEditForm({ group, onOpenChange }: { group: RecurringGroup; onOpenChange: (open: boolean) => void }) {
  const { data: categories } = useCategories();
  const [categoryId, setCategoryId] = useState(group.categoryId ?? NO_CATEGORY);
  const updateRecurring = useUpdateRecurring();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    updateRecurring.mutate(
      { id: group.id, input: { categoryId: categoryId === NO_CATEGORY ? null : categoryId } },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  const errorMessage =
    updateRecurring.error instanceof ApiError
      ? updateRecurring.error.message
      : updateRecurring.error
        ? "No se pudo conectar con el servidor"
        : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar grupo recurrente</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <p className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-slate-700">
          {group.description}
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={updateRecurring.isPending}>
            {updateRecurring.isPending && <Spinner className="text-white" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
