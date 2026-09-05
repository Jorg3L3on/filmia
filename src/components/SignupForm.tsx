"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { messageForSignInError } from "@/lib/auth-errors";
import { btnPrimary, fieldClass, focusRing } from "@/lib/ui";

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

    if (!response.ok) {
      setError(payload.error ?? "No se pudo crear la cuenta.");
      setIsLoading(false);
      return;
    }

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error || result?.ok === false) {
      setError(messageForSignInError(result.error, "register"));
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-6 rounded-3xl border border-line bg-surface/90 p-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
      >
        <div className="space-y-2 text-center">
          <h1 className="font-serif text-4xl text-paper">Filmia</h1>
          <p className="text-sm font-medium text-accent">Registro</p>
        </div>

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

        <button
          type="submit"
          disabled={isLoading}
          className={`${btnPrimary} w-full disabled:opacity-60`}
        >
          {isLoading ? "Creando…" : "Crear cuenta"}
        </button>

        <p className="text-center text-sm text-mist">
          Ya tengo cuenta{" "}
          <Link href="/login" className={`text-accent hover:text-accent-hover ${focusRing}`}>
            → Entrar
          </Link>
        </p>
      </form>
    </div>
  );
};
