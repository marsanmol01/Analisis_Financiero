import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { useRegenerateRecoveryCodes } from "../../hooks/use-totp";
import { ApiError } from "../../lib/api-client";
import { RecoveryCodesList } from "./recovery-codes-list";

export function RegenerateRecoveryCodesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {open && <RegenerateForm onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function RegenerateForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const regenerate = useRegenerateRecoveryCodes();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    regenerate.mutate(password, { onSuccess: (result) => setNewCodes(result.recoveryCodes) });
  }

  const errorMessage = regenerate.error instanceof ApiError ? regenerate.error.message : regenerate.error ? "No se pudo conectar con el servidor" : null;

  if (newCodes) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Nuevos códigos de recuperación</DialogTitle>
          <DialogDescription>
            Los códigos anteriores han dejado de funcionar. Guarda estos en un lugar seguro; no volverán a mostrarse.
          </DialogDescription>
        </DialogHeader>
        <RecoveryCodesList codes={newCodes} />
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Ya los he guardado</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Regenerar códigos de recuperación</DialogTitle>
        <DialogDescription>
          Se generará un lote nuevo de 10 códigos y los actuales dejarán de servir. Confirma tu contraseña.
        </DialogDescription>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="regenerate-password">Contraseña</Label>
          <Input
            id="regenerate-password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={regenerate.isPending || !password}>
            {regenerate.isPending && <Spinner className="text-white" />}
            Regenerar
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
