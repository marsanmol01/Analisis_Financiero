import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useCategories, useCreateCategory, useUpdateCategory } from "../../hooks/use-categories";
import { ApiError } from "../../lib/api-client";
import type { Category } from "../../types/category";

const NO_PARENT = "__none__";

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Se desmonta al cerrar el dialogo, asi cada apertura arranca con estado limpio sin
            necesidad de un efecto que sincronice el formulario con la categoria a editar. */}
        {open && <CategoryForm category={category} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({ category, onOpenChange }: { category?: Category; onOpenChange: (open: boolean) => void }) {
  const { data: categories } = useCategories();
  const [name, setName] = useState(category?.name ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? NO_PARENT);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const isEditing = Boolean(category);
  const mutation = isEditing ? updateCategory : createCategory;

  // No se puede elegir la propia categoria (ni sus hijas directas) como padre.
  const parentOptions = (categories ?? []).filter((c) => c.id !== category?.id && c.parentId !== category?.id);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { name, parentId: parentId === NO_PARENT ? undefined : parentId };
    const onSuccess = () => onOpenChange(false);
    if (category) {
      updateCategory.mutate({ id: category.id, input }, { onSuccess });
    } else {
      createCategory.mutate(input, { onSuccess });
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
        <DialogTitle>{isEditing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-name">Nombre</Label>
          <Input id="category-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Categoría padre (opcional)</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>Ninguna (categoría de primer nivel)</SelectItem>
              {parentOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="text-white" />}
            {isEditing ? "Guardar cambios" : "Crear categoría"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
