import { useState } from "react";
import { ListChecks, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useAccounts } from "../../hooks/use-accounts";
import { useCategories } from "../../hooks/use-categories";
import { useClassificationRules, useDeleteRule, useReclassify } from "../../hooks/use-classification-rules";
import { formatCurrency } from "../../lib/format";
import { RULE_OPERATOR_LABELS } from "../../lib/rule-operators";
import type { ClassificationRule } from "../../types/classification-rule";
import { RuleFormDialog } from "./rule-form-dialog";

export function ClassificationRulesPage() {
  const { data: rules, isLoading, isError } = useClassificationRules();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const deleteRule = useDeleteRule();
  const reclassify = useReclassify();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ClassificationRule | undefined>(undefined);
  const [deletingRule, setDeletingRule] = useState<ClassificationRule | undefined>(undefined);
  const [reclassifyMessage, setReclassifyMessage] = useState<string | null>(null);

  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const categoriesById = new Map((categories ?? []).map((c) => [c.id, c]));

  function openCreate() {
    setEditingRule(undefined);
    setFormOpen(true);
  }

  function openEdit(rule: ClassificationRule) {
    setEditingRule(rule);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deletingRule) return;
    deleteRule.mutate(deletingRule.id, { onSuccess: () => setDeletingRule(undefined) });
  }

  function handleReclassify() {
    setReclassifyMessage(null);
    reclassify.mutate(undefined, {
      onSuccess: (result) =>
        setReclassifyMessage(
          `Se revisaron ${result.scanned} movimientos sin categorizar a mano; se actualizaron ${result.updated}.`,
        ),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reglas de clasificación</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Se aplican automáticamente a cada movimiento nuevo, por orden de prioridad.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReclassify} disabled={reclassify.isPending}>
            {reclassify.isPending ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            Reclasificar movimientos existentes
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva regla
          </Button>
        </div>
      </div>

      {reclassifyMessage && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-positive)]/20 bg-[var(--color-positive-muted)] px-3 py-2 text-sm text-[var(--color-positive)]">
          {reclassifyMessage}
          <button type="button" onClick={() => setReclassifyMessage(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando reglas…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar las reglas. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {rules && rules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ListChecks className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no has creado ninguna regla.</p>
            <Button variant="outline" onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Crear la primera
            </Button>
          </CardContent>
        </Card>
      )}

      {rules && rules.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridad</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Importe</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="text-[var(--color-text-muted)]">{rule.priority}</TableCell>
                  <TableCell>
                    {RULE_OPERATOR_LABELS[rule.operator]} <span className="font-medium">"{rule.value}"</span>
                  </TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {rule.accountId ? (accountsById.get(rule.accountId)?.name ?? "—") : "Todas"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[var(--color-text-muted)]">
                    {rule.minAmount || rule.maxAmount
                      ? `${rule.minAmount ? formatCurrency(Number(rule.minAmount)) : "…"} a ${
                          rule.maxAmount ? formatCurrency(Number(rule.maxAmount)) : "…"
                        }`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="brand">{categoriesById.get(rule.categoryId)?.name ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    {rule.isActive ? <Badge variant="positive">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingRule(rule)}>
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <RuleFormDialog open={formOpen} onOpenChange={setFormOpen} rule={editingRule} />

      <ConfirmDialog
        open={Boolean(deletingRule)}
        onOpenChange={(open) => !open && setDeletingRule(undefined)}
        title="Eliminar regla"
        description="Dejará de aplicarse a los movimientos futuros. Los movimientos ya clasificados con ella no cambian."
        isPending={deleteRule.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
