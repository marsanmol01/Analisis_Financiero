import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Spinner } from "../../components/ui/spinner";
import { useAddMerchantAlias, useRemoveMerchantAlias } from "../../hooks/use-merchants";
import type { Category } from "../../types/category";
import type { Merchant } from "../../types/merchant";

export function MerchantCard({
  merchant,
  defaultCategory,
  onEdit,
  onDelete,
}: {
  merchant: Merchant;
  defaultCategory?: Category;
  onEdit: (merchant: Merchant) => void;
  onDelete: (merchant: Merchant) => void;
}) {
  const [newAlias, setNewAlias] = useState("");
  const addAlias = useAddMerchantAlias();
  const removeAlias = useRemoveMerchantAlias();

  function handleAddAlias(event: FormEvent) {
    event.preventDefault();
    if (!newAlias.trim()) return;
    addAlias.mutate(
      { merchantId: merchant.id, pattern: newAlias.trim() },
      { onSuccess: () => setNewAlias("") },
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-slate-900">{merchant.name}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {defaultCategory ? defaultCategory.name : "Sin categoría por defecto"}
            </p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(merchant)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(merchant)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">
            Alias (fragmentos de descripción que identifican este comercio)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {merchant.aliases.length === 0 && (
              <span className="text-xs text-[var(--color-text-muted)]">Todavía no tiene alias.</span>
            )}
            {merchant.aliases.map((alias) => (
              <Badge key={alias.id} variant="neutral" className="gap-1 pr-1">
                {alias.pattern}
                <button
                  type="button"
                  aria-label={`Eliminar alias ${alias.pattern}`}
                  className="rounded-full hover:bg-slate-200"
                  disabled={removeAlias.isPending}
                  onClick={() => removeAlias.mutate({ merchantId: merchant.id, aliasId: alias.id })}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <form className="flex gap-1.5" onSubmit={handleAddAlias}>
            <Input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="Añadir alias…"
              maxLength={120}
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" variant="outline" disabled={addAlias.isPending || !newAlias.trim()}>
              {addAlias.isPending ? <Spinner /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
