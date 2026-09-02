import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { useDisableTotp } from "../../hooks/use-totp";
import { ApiError } from "../../lib/api-client";

export function TotpDisableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <TotpDisableForm onOpenChange={onOpenChange} />}</DialogContent>
    </Dialog>
  );
}

function TotpDisableForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const disableTotp = useDisableTotp();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    disableTotp.mutate({ password, code }, { onSuccess: () => onOpenChange(false) });
  }

  const errorMessage =
    disableTotp.error instanceof ApiError
      ? disableTotp.error.message
      : disableTotp.error
        ? "No se pudo conectar con el servidor"
        : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Desactivar verificación en dos pasos</DialogTitle>
        <DialogDescription>
          Por seguridad, confirma tu contraseña y un código actual de tu aplicación de autenticación.
        </DialogDescription>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="disable-totp-password">Contraseña</Label>
          <Input
            id="disable-totp-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="disable-totp-code">Código de 6 dígitos</Label>
          <Input
            id="disable-totp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="destructive" disabled={disableTotp.isPending || code.length !== 6 || !password}>
            {disableTotp.isPending && <Spinner className="text-white" />}
            Desactivar
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
