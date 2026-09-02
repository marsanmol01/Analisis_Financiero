import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { useEnableTotp, useSetupTotp } from "../../hooks/use-totp";
import { ApiError } from "../../lib/api-client";

export function TotpSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <TotpSetupForm onOpenChange={onOpenChange} />}</DialogContent>
    </Dialog>
  );
}

function TotpSetupForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const setupTotp = useSetupTotp();
  const enableTotp = useEnableTotp();
  const [code, setCode] = useState("");

  // Peticion al servidor (genera y guarda un secreto nuevo) al abrir el dialogo: es una
  // sincronizacion con un sistema externo, el caso legitimo para un efecto — no un setState
  // interno que pudiera derivarse directamente del render.
  useEffect(() => {
    setupTotp.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    enableTotp.mutate(code, { onSuccess: () => onOpenChange(false) });
  }

  const errorMessage =
    setupTotp.error instanceof ApiError
      ? setupTotp.error.message
      : enableTotp.error instanceof ApiError
        ? enableTotp.error.message
        : setupTotp.error || enableTotp.error
          ? "No se pudo conectar con el servidor"
          : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Activar verificación en dos pasos</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <FormError message={errorMessage} />

        {setupTotp.isPending && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {setupTotp.data && (
          <>
            <p className="text-sm text-slate-700">
              Escanea este código con tu aplicación de autenticación (Google Authenticator, Authy, 1Password...).
            </p>
            <img
              src={setupTotp.data.qrCodeDataUrl}
              alt="Código QR para configurar la verificación en dos pasos"
              className="mx-auto h-48 w-48"
            />
            <div className="flex flex-col gap-1.5">
              <Label>O introduce este código manualmente</Label>
              <code className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-center text-sm tracking-widest">
                {setupTotp.data.secret}
              </code>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enable-totp-code">Código de 6 dígitos</Label>
                <Input
                  id="enable-totp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={enableTotp.isPending || code.length !== 6}>
                  {enableTotp.isPending && <Spinner className="text-white" />}
                  Activar
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </div>
    </>
  );
}
