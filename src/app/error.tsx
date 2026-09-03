"use client";

import { btnPrimary } from "@/lib/ui";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const ErrorPage = ({ error, reset }: ErrorPageProps) => {
  const handleClick = () => {
    reset();
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-md border border-dashed border-chrome bg-well/70 px-6 py-16 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
        Error
      </p>
      <h1 className="font-serif text-3xl text-white">Algo salió mal</h1>
      <p className="text-sm leading-relaxed text-fog">{error.message}</p>
      <button type="button" onClick={handleClick} className={btnPrimary}>
        Reintentar
      </button>
    </div>
  );
};

export default ErrorPage;
