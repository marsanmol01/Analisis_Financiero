import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "./auth-layout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { useLogin, useRegister } from "../../hooks/use-auth";
import { ApiError } from "../../lib/api-client";

const MIN_PASSWORD_LENGTH = 12;

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const register = useRegister();
  const login = useLogin();
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setValidationError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("Las contraseñas no coinciden");
      return;
    }

    register.mutate(
      { email, password },
      {
        // Registrar no inicia sesión por si mismo (el backend lo hace deliberadamente): se
        // encadena un login con las mismas credenciales para que el alta quede lista para usar.
        onSuccess: () => {
          login.mutate({ email, password }, { onSuccess: () => navigate("/", { replace: true }) });
        },
      },
    );
  }

  const apiError = register.error instanceof ApiError ? register.error.message : null;
  const errorMessage =
    validationError ?? apiError ?? (register.error || login.error ? "No se pudo conectar con el servidor" : null);
  const isPending = register.isPending || login.isPending;

  return (
    <AuthLayout title="Crear cuenta" subtitle="Empieza a centralizar tus finanzas">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormError message={errorMessage} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-[var(--color-text-muted)]">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Repite la contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending && <Spinner className="text-white" />}
          Crear cuenta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-medium text-[var(--color-brand-600)] hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
