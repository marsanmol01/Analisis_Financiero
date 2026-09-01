import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AuthLayout } from "./auth-layout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { useLogin } from "../../hooks/use-auth";
import { ApiError } from "../../lib/api-client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate(from, { replace: true }),
      },
    );
  }

  const errorMessage =
    login.error instanceof ApiError
      ? (login.error.status === 403 ? login.error.message : "Email o contraseña incorrectos")
      : login.error
        ? "No se pudo conectar con el servidor"
        : null;

  return (
    <AuthLayout title="Iniciar sesión" subtitle="Accede a tus finanzas personales">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={login.isPending} className="mt-2">
          {login.isPending && <Spinner className="text-white" />}
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="font-medium text-[var(--color-brand-600)] hover:underline">
          Crear una
        </Link>
      </p>
    </AuthLayout>
  );
}
