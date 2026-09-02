import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useCurrentUser } from "../../hooks/use-auth";
import { TotpDisableDialog } from "./totp-disable-dialog";
import { TotpSetupDialog } from "./totp-setup-dialog";

export function SettingsPage() {
  const { data: user } = useCurrentUser();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Ajustes de tu cuenta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seguridad</CardTitle>
          <CardDescription>Protege el acceso a tu cuenta con un segundo factor.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-0">
          <div className="flex items-center gap-3">
            <ShieldCheck
              className={user?.totpEnabled ? "h-5 w-5 text-[var(--color-positive)]" : "h-5 w-5 text-slate-300"}
            />
            <div>
              <p className="text-sm font-medium text-slate-900">Verificación en dos pasos</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {user?.totpEnabled
                  ? "Activada — se pedirá un código además de la contraseña al iniciar sesión."
                  : "Desactivada."}
              </p>
            </div>
          </div>
          {user?.totpEnabled ? (
            <Button variant="destructive" onClick={() => setDisableOpen(true)}>
              Desactivar
            </Button>
          ) : (
            <Button onClick={() => setSetupOpen(true)}>Activar</Button>
          )}
        </CardContent>
      </Card>

      <TotpSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <TotpDisableDialog open={disableOpen} onOpenChange={setDisableOpen} />
    </div>
  );
}
