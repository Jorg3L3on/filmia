"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { btnPrimary, eyebrowClass, fieldClass, focusRing } from "@/lib/ui";

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
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16">
      <div className="space-y-4 text-center">
        <Link href="/" className={`inline-flex ${focusRing}`} aria-label="Filmia">
          <Logo size="lg" />
        </Link>
        <div className="space-y-2">
          <p className={eyebrowClass}>Registro</p>
          <h1 className="font-serif text-3xl text-paper">Crear cuenta</h1>
          <p className="text-sm text-mist">
            Empieza tu diario cinematográfico personal.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-md border border-line bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
      >
        {error ? (
          <p
            role="alert"
            className="rounded-sm border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Nombre (opcional)
          </span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            className={fieldClass}
            placeholder="Tu nombre"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Correo
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className={fieldClass}
            placeholder="tu@correo.com"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Contraseña
          </span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={fieldClass}
            placeholder="Mínimo 8 caracteres"
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className={`${btnPrimary} w-full disabled:opacity-60`}
        >
          {isLoading ? "Creando…" : "Crear cuenta"}
        </button>
      </form>

      <p className="text-center text-sm text-mist">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-accent underline-offset-2 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
};
