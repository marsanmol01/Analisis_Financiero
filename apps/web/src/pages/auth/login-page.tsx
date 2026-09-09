import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AuthLayout } from "./auth-layout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FormError } from "../../components/ui/form-error";
import { Spinner } from "../../components/ui/spinner";
import { useLogin, useVerifyTotpLogin } from "../../hooks/use-auth";
import { ApiError } from "../../lib/api-client";

type Step = "credentials" | "totp";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [recoveryWarning, setRecoveryWarning] = useState<string | null>(null);
  const login = useLogin();
  const verifyTotpLogin = useVerifyTotpLogin();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: (result) => {
          if (result.status === "totp_required") {
            setStep("totp");
          } else {
            navigate(from, { replace: true });
          }
        },
      },
    );
  }

  function handleTotpSubmit(event: FormEvent) {
    event.preventDefault();
    verifyTotpLogin.mutate(code, {
      onSuccess: (result) => {
        if (result.recoveryCodeWarning) {
          setRecoveryWarning(result.recoveryCodeWarning);
        } else {
          navigate(from, { replace: true });
        }
      },
    });
  }

  function backToCredentials() {
    setStep("credentials");
    setCode("");
    verifyTotpLogin.reset();
  }

  const credentialsError =
    login.error instanceof ApiError
      ? login.error.status === 403
        ? login.error.message
        : "Email o contraseña incorrectos"
      : login.error
        ? "No se pudo conectar con el servidor"
        : null;

  const totpError =
    verifyTotpLogin.error instanceof ApiError
      ? verifyTotpLogin.error.status === 403
        ? verifyTotpLogin.error.message
        : "Código incorrecto"
      : verifyTotpLogin.error
        ? "No se pudo conectar con el servidor"
        : null;

  if (recoveryWarning) {
    return (
      <AuthLayout title="Código de recuperación usado" subtitle="Ten en cuenta esto antes de continuar">
        <p className="rounded-md border border-[var(--color-warning)]/20 bg-[var(--color-warning-muted)] px-3 py-2 text-sm text-[var(--color-warning)]">
          {recoveryWarning}
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate(from, { replace: true })}>
          Continuar
        </Button>
      </AuthLayout>
    );
  }

  if (step === "totp") {
    return (
      <AuthLayout title="Verificación en dos pasos" subtitle="Introduce el código de tu aplicación de autenticación">
        <form className="flex flex-col gap-4" onSubmit={handleTotpSubmit}>
          <FormError message={totpError} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="totp-code">Código de 6 dígitos</Label>
            <Input
              id="totp-code"
              autoComplete="one-time-code"
              maxLength={11}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, 11))}
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              ¿Sin acceso a tu aplicación de autenticación? Usa uno de tus códigos de recuperación.
            </p>
          </div>
          <Button type="submit" disabled={verifyTotpLogin.isPending || !code} className="mt-2">
            {verifyTotpLogin.isPending && <Spinner className="text-white" />}
            Verificar
          </Button>
        </form>
        <button
          type="button"
          onClick={backToCredentials}
          className="mt-6 w-full text-center text-sm text-[var(--color-text-muted)] hover:underline"
        >
          Volver
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Iniciar sesión" subtitle="Accede a tus finanzas personales">
      <form className="flex flex-col gap-4" onSubmit={handleCredentialsSubmit}>
        <FormError message={credentialsError} />
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
