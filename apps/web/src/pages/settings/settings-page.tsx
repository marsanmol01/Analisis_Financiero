import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useCurrentUser } from "../../hooks/use-auth";
import { useRecoveryCodesStatus } from "../../hooks/use-totp";
import { TotpDisableDialog } from "./totp-disable-dialog";
import { TotpSetupDialog } from "./totp-setup-dialog";
import { RegenerateRecoveryCodesDialog } from "./regenerate-recovery-codes-dialog";

export function SettingsPage() {
  const { data: user } = useCurrentUser();
  const { data: recoveryStatus } = useRecoveryCodesStatus(Boolean(user?.totpEnabled));
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

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

        {user?.totpEnabled && (
          <CardContent className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-6">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">Códigos de recuperación</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {recoveryStatus ? `Te quedan ${recoveryStatus.remaining} sin usar.` : "Para entrar si pierdes el acceso a tu app de autenticación."}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setRegenerateOpen(true)}>
              Regenerar
            </Button>
          </CardContent>
        )}
      </Card>

      <TotpSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <TotpDisableDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <RegenerateRecoveryCodesDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} />
    </div>
  );
}
