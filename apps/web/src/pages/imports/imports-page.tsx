import { Link } from "react-router";
import { Plus, Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useImports } from "../../hooks/use-imports";
import { useAccounts } from "../../hooks/use-accounts";
import { formatDate } from "../../lib/format";

export function ImportsPage() {
  const { data: imports, isLoading, isError } = useImports();
  const { data: accounts } = useAccounts();
  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Importaciones</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Sube extractos en CSV o XLSX para cargar movimientos en tus cuentas.
          </p>
        </div>
        <Button asChild>
          <Link to="/imports/new">
            <Plus className="h-4 w-4" />
            Nueva importación
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando importaciones…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudieron cargar las importaciones. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {imports && imports.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Upload className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-[var(--color-text-muted)]">Todavía no has importado ningún fichero.</p>
            <Button variant="outline" asChild className="mt-2">
              <Link to="/imports/new">
                <Plus className="h-4 w-4" />
                Importar el primero
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {imports && imports.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Fichero</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Importados</TableHead>
                <TableHead className="text-right">Duplicados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="whitespace-nowrap text-[var(--color-text-muted)]">
                    {formatDate(record.createdAt)}
                  </TableCell>
                  <TableCell>{record.filename}</TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {accountsById.get(record.accountId)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="positive">{record.importedCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="neutral">{record.duplicateCount}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
