import { Card, CardContent } from "../components/ui/card";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <Card>
        <CardContent className="pt-6 text-sm text-[var(--color-text-muted)]">
          Esta sección todavía no está construida — llega en un próximo bloque.
        </CardContent>
      </Card>
    </div>
  );
}
