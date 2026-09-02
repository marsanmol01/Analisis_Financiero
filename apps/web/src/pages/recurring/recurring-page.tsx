import { useState } from "react";
import { Pencil, Plus, Repeat, Search, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useAccounts } from "../../hooks/use-accounts";
import { useCategories } from "../../hooks/use-categories";
import { useDeleteRecurring, useDetectRecurring, useRecurringGroups, useUpdateRecurring } from "../../hooks/use-recurring";
import { formatCurrency, formatDate } from "../../lib/format";
import { RECURRING_FREQUENCY_LABELS } from "../../lib/recurring-frequency";
import type { RecurringGroup } from "../../types/recurring";
import { ManualRecurringDialog } from "./manual-recurring-dialog";
import { RecurringEditDialog } from "./recurring-edit-dialog";

export function RecurringPage() {
  const { data: groups, isLoading, isError } = useRecurringGroups();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const detectRecurring = useDetectRecurring();
  const updateRecurring = useUpdateRecurring();
  const deleteRecurring = useDeleteRecurring();

  const [manualOpen, setManualOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RecurringGroup | undefined>(undefined);
  const [deletingGroup, setDeletingGroup] = useState<RecurringGroup | undefined>(undefined);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const categoriesById = new Map((categories ?? []).map((c) => [c.id, c]));

  function handleDetect() {
    setDetectMessage(null);
    detectRecurring.mutate(undefined, {
      onSuccess: (result) =>
        setDetectMessage(
          `${result.groupsCreated} grupos nuevos, ${result.groupsUpdated} actualizados, ${result.transactionsLinked} movimientos enlazados.`,
        ),
    });
  }

  function confirmDelete() {
    if (!deletingGroup) return;
    deleteRecurring.mutate(deletingGroup.id, { onSuccess: () => setDeletingGroup(undefined) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gastos e ingresos recurrentes</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Pagos que se repiten con un patrón regular: suscripciones, alquiler, nómina…
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDetect} disabled={detectRecurring.isPending}>
            {detectRecurring.isPending ? <Spinner /> : <Search className="h-4 w-4" />}
            Detectar automáticamente
          </Button>
          <Button onClick={() => setManualOpen(true)}>
            <Plus className="h-4 w-4" />
            Crear manualmente
          </Button>
        </div>
      </div>

      {detectMessage && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-positive)]/20 bg-[var(--color-positive-muted)] px-3 py-2 text-sm text-[var(--color-positive)]">
          {detectMessage}
          <button type="button" onClick={() => setDetectMessage(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando grupos recurrentes…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar los grupos recurrentes. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {groups && groups.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Repeat className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">
              Todavía no hay ningún grupo recurrente. Prueba a detectarlos automáticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {groups && groups.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead className="text-right">Importe típico</TableHead>
                <TableHead>Próximo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="max-w-[16rem] truncate">{group.description}</TableCell>
                  <TableCell className="whitespace-nowrap text-[var(--color-text-muted)]">
                    {accountsById.get(group.accountId)?.name ?? "—"}
                  </TableCell>
                  <TableCell>{RECURRING_FREQUENCY_LABELS[group.frequency]}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {formatCurrency(Number(group.typicalAmount))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[var(--color-text-muted)]">
                    {group.nextEstimatedDate ? formatDate(group.nextEstimatedDate) : "—"}
                  </TableCell>
                  <TableCell>
                    {group.categoryId ? (
                      <Badge variant="brand">{categoriesById.get(group.categoryId)?.name ?? "—"}</Badge>
                    ) : (
                      <Badge variant="neutral">Sin categoría</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{group.isManual ? "Manual" : "Automático"}</Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => updateRecurring.mutate({ id: group.id, input: { isActive: !group.isActive } })}
                      disabled={updateRecurring.isPending}
                    >
                      {group.isActive ? (
                        <Badge variant="positive">Activo</Badge>
                      ) : (
                        <Badge variant="neutral">Inactivo</Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingGroup(group)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingGroup(group)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ManualRecurringDialog open={manualOpen} onOpenChange={setManualOpen} />
      <RecurringEditDialog open={Boolean(editingGroup)} onOpenChange={(open) => !open && setEditingGroup(undefined)} group={editingGroup} />

      <ConfirmDialog
        open={Boolean(deletingGroup)}
        onOpenChange={(open) => !open && setDeletingGroup(undefined)}
        title="Eliminar grupo recurrente"
        description="Los movimientos que forman parte de este grupo no se borran, solo dejan de estar agrupados."
        isPending={deleteRecurring.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
