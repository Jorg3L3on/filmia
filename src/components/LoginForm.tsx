"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { btnPrimary, fieldClass, focusRing } from "@/lib/ui";

export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { error?: string };

    setIsLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Correo o contraseña incorrectos.");
      return;
    }

    router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
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
          <p className="text-[11px] font-medium tracking-[0.22em] text-mist">
            CINE. HISTORIAS. EMOCIONES.
          </p>
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
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Correo electrónico
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className={fieldClass}
            placeholder="tu@email.com"
          />
        </label>

        <PasswordField
          name="password"
          label="Contraseña"
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={isLoading}
          className={`${btnPrimary} w-full disabled:opacity-60`}
        >
          {isLoading ? "Entrando…" : "Entrar"}
        </button>

        <div className="flex items-center gap-3 text-xs text-mist">
          <span className="h-px flex-1 bg-line" />
          o
          <span className="h-px flex-1 bg-line" />
        </div>

        <p className="text-center text-sm">
          <Link href="/registro" className={`text-accent hover:text-accent-hover ${focusRing}`}>
            Crear cuenta
          </Link>
        </p>
      </form>
    </div>
  );
};
