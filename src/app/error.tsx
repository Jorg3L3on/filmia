"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
};

const ErrorPage = ({ error, retry, reset }: ErrorPageProps) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const handleRetry = () => {
    if (retry) {
      retry();
      return;
    }
    reset?.();
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
        Corte
      </p>
      <h1 className="font-serif text-3xl text-paper">Algo salió mal</h1>
      <p className="text-sm leading-relaxed text-fog">
        Esta escena no cargó. Reintenta o vuelve al Diario; si sigue fallando, el
        problema es nuestro, no tuyo.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button type="button" onClick={handleRetry}>
          Reintentar
        </Button>
        <Button href="/" variant="ghost">
          Volver al Diario
        </Button>
      </div>
    </div>
  );
};

export default ErrorPage;
