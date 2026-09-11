"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function TitleDetailError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-danger-line bg-danger-well px-6 py-16 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-danger">
        Corte
      </p>
      <h1 className="font-serif text-3xl text-paper">La ficha no cargó</h1>
      <p className="text-sm leading-relaxed text-fog">
        Esta escena falló. Reintenta; si sigue igual, el problema es nuestro, no
        tuyo.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={reset}>
          Reintentar
        </Button>
        <Button href="/" variant="ghost">
          Volver al Diario
        </Button>
      </div>
    </div>
  );
}
