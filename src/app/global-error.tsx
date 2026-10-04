"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";
import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
};

const GlobalError = ({ error, retry, reset }: GlobalErrorProps) => {
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
    <html lang="es">
      <body className="flex min-h-full flex-col bg-canvas text-paper antialiased">
        <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
            Filmia
          </p>
          <h1 className="mt-3 font-serif text-3xl text-paper">Algo salió mal</h1>
          <p className="mt-3 text-sm leading-relaxed text-fog">
            No pudimos armar esta pantalla. Reintenta en un momento.
          </p>
          <Button type="button" onClick={handleRetry} className="mt-8">
            Reintentar
          </Button>
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
