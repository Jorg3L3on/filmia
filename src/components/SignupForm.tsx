"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { Button } from "@/components/Button";
import { PasswordField } from "@/components/PasswordField";
import { fieldClass, focusRing } from "@/lib/ui";

export const SignupForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { error?: string };

    setIsLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo crear la cuenta.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <AuthScreen
      title="Crear cuenta en Filmia"
      footer={
        <p className="text-center text-sm text-mist">
          Ya tengo cuenta{" "}
          <Link href="/login" className={`text-accent hover:text-accent-hover ${focusRing}`}>
            → Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">Nombre</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            className={fieldClass}
            placeholder="Tu nombre"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">Correo</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className={fieldClass}
            placeholder="tu@correo.com"
          />
        </label>

        <PasswordField
          name="password"
          label="Contraseña"
          autoComplete="new-password"
          minLength={8}
          placeholder="Mínimo 8 caracteres"
        />

        <Button
          type="submit"
          pending={isLoading}
          pendingLabel="Creando…"
          className="w-full"
        >
          Crear cuenta
        </Button>
      </form>
    </AuthScreen>
  );
};
