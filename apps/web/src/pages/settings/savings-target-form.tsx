import { useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useUpdateSettings } from "../../hooks/use-auth";
import type { User } from "../../types/auth";

export function SavingsTargetForm({ user }: { user: User }) {
  const updateSettings = useUpdateSettings();
  const [value, setValue] = useState(user.monthlySavingsTarget != null ? String(user.monthlySavingsTarget) : "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    updateSettings.mutate({ monthlySavingsTarget: trimmed === "" ? null : Number(trimmed) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ahorro</CardTitle>
        <CardDescription>
          Cuánto quieres ahorrar cada mes/ciclo de nómina. Sin fecha límite — se compara en los consejos del
          dashboard, no crea un objetivo con plazo.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form className="flex items-end gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monthly-savings-target">Objetivo de ahorro mensual (€)</Label>
            <Input
              id="monthly-savings-target"
              type="number"
              min="0"
              step="0.01"
              placeholder="Sin fijar"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="submit" disabled={updateSettings.isPending}>
            Guardar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
