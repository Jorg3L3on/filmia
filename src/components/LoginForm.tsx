"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { messageForSignInError } from "@/lib/auth-errors";
import { btnPrimary, eyebrowClass, fieldClass, focusRing } from "@/lib/ui";

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
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error || result?.ok === false) {
      setError(messageForSignInError(result.error));
      return;
    }

    router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
    router.refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16">
      <div className="space-y-4 text-center">
        <Link href="/" className={`inline-flex ${focusRing}`} aria-label="Filmia">
          <Logo size="lg" />
        </Link>
        <div className="space-y-2">
          <p className={eyebrowClass}>Acceso</p>
          <h1 className="font-serif text-3xl text-paper">Entrar a Filmia</h1>
          <p className="text-sm text-mist">
            Tu diario personal de películas y series.
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
            autoComplete="current-password"
            required
            className={fieldClass}
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className={`${btnPrimary} w-full disabled:opacity-60`}
        >
          {isLoading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="text-center text-sm text-mist">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="text-accent underline-offset-2 hover:underline">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
};
