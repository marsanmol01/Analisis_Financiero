import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useCategories, useDeleteCategory } from "../../hooks/use-categories";
import type { Category } from "../../types/category";
import { CategoryFormDialog } from "./category-form-dialog";

export function CategoriesPage() {
  const { data: categories, isLoading, isError } = useCategories();
  const deleteCategory = useDeleteCategory();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [deletingCategory, setDeletingCategory] = useState<Category | undefined>(undefined);

  function openCreate() {
    setEditingCategory(undefined);
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditingCategory(category);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deletingCategory) return;
    deleteCategory.mutate(deletingCategory.id, { onSuccess: () => setDeletingCategory(undefined) });
  }

  const topLevel = (categories ?? []).filter((c) => !c.parentId);
  const childrenOf = (parentId: string) => (categories ?? []).filter((c) => c.parentId === parentId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Categorías</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Organiza tus movimientos. Las categorías del sistema son de solo lectura.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando categorías…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar las categorías. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {categories && categories.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Tags className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no has creado ninguna categoría propia.</p>
          </CardContent>
        </Card>
      )}

      {categories && categories.length > 0 && (
        <Card>
          <CardContent className="divide-y divide-[var(--color-border)] pt-0">
            {topLevel.map((category) => (
              <div key={category.id} className="py-2 first:pt-6 last:pb-6">
                <CategoryRow category={category} onEdit={openEdit} onDelete={setDeletingCategory} />
                {childrenOf(category.id).map((child) => (
                  <div key={child.id} className="pl-8">
                    <CategoryRow category={child} onEdit={openEdit} onDelete={setDeletingCategory} />
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editingCategory} />

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        onOpenChange={(open) => !open && setDeletingCategory(undefined)}
        title="Eliminar categoría"
        description={`Se eliminará "${deletingCategory?.name}". Los movimientos que la usaban se quedarán sin categoría.`}
        isPending={deleteCategory.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-900">{category.name}</span>
        {category.isSystem && <Badge variant="neutral">Sistema</Badge>}
      </div>
      {!category.isSystem && (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(category)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(category)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
