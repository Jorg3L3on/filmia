"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logoutUser } from "@/app/actions/auth";
import { joinWithInvite } from "@/app/actions/list-sharing";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

const primary = cn(
  "press-scale inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-ink transition hover:bg-accent-hover disabled:opacity-70",
  focusRing,
);
const secondary = cn(
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-6 text-sm font-semibold text-paper transition hover:bg-white/10",
  focusRing,
);

type State = "idle" | "pending" | "unavailable" | "error";

/**
 * Canvas 2·1–2·3: sign in (or create an account) and come back here, then
 * «Solicitar unirme»; once sent, «En espera» until the owner decides.
 */
export const JoinListActions = ({
  token,
  ownerFirstName,
  listName,
  signedInAs,
  callbackPath,
  initiallyPending,
}: {
  token: string;
  ownerFirstName: string;
  listName: string;
  signedInAs: string | null;
  callbackPath: string;
  initiallyPending: boolean;
}) => {
  const router = useRouter();
  const [state, setState] = useState<State>(initiallyPending ? "pending" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const callback = encodeURIComponent(callbackPath);

  if (!signedInAs) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link href={`/login?callbackUrl=${callback}`} className={primary}>
          Inicia sesión para unirte
        </Link>
        <Link href={`/registro?callbackUrl=${callback}`} className={secondary}>
          Crear cuenta
        </Link>
        <p className="text-xs text-fog">Con correo o con Google.</p>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-accent/30 bg-accent/[0.08] px-5 py-6 shadow-[0_0_60px_-20px_var(--color-accent)]">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">En espera</p>
          <h2 className="font-serif text-xl text-paper">Solicitud enviada</h2>
          <p className="text-pretty text-sm text-fog">
            {ownerFirstName} tiene que aprobarte. Mientras, «{listName}» te espera en Listas → Compartidas conmigo.
          </p>
        </div>
        <Link href="/" className={primary}>
          Ir a Hoy
        </Link>
        <Link href="/listas" className="block text-sm text-fog underline-offset-4 hover:text-paper hover:underline">
          Ver Compartidas conmigo
        </Link>
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className="w-full max-w-sm space-y-2 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-6">
        <h2 className="font-serif text-xl text-paper">Este link ya no sirve</h2>
        <p className="text-sm text-fog">Pídele un link nuevo a {ownerFirstName}.</p>
      </div>
    );
  }

  const request = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const outcome = await joinWithInvite(token);
        switch (outcome.status) {
          case "member":
          case "joined":
            router.replace(`/listas/${outcome.listId}`);
            return;
          case "requested":
          case "pending":
            setState("pending");
            return;
          case "rate_limited":
            setMessage(outcome.error);
            return;
          default:
            setState("unavailable");
        }
      } catch {
        setMessage("No se pudo enviar. Inténtalo de nuevo.");
      }
    });
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <button type="button" onClick={request} disabled={isPending} aria-busy={isPending || undefined} className={primary}>
        {isPending ? "Enviando…" : "Solicitar unirme"}
      </button>
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      <p className="text-xs text-fog">
        Entras como <span className="text-paper">{signedInAs}</span> ·{" "}
        <button
          type="button"
          onClick={() => startTransition(() => logoutUser(callbackPath))}
          className={cn("underline-offset-4 hover:text-paper hover:underline", focusRing)}
        >
          No soy yo
        </button>
      </p>
    </div>
  );
};
