"use client";

import { useId, useTransition } from "react";
import { pinTonightFromSearch } from "@/app/actions/tonight";
import { Button } from "@/components/Button";
import { PosterImage } from "@/components/PosterImage";
import { RutaProgress } from "@/components/rutas/RutaProgress";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { pulseNav } from "@/lib/fly-to-nav";
import type { RutaReveal } from "@/lib/rutas/reveal";
import { showToast } from "@/lib/toast";
import { formatRuntimeShort } from "@/lib/tonight/time";

type RutaRevealSheetProps = {
  reveal: RutaReveal | null;
  onClose: () => void;
};

const left = (count: number) => (count === 1 ? "queda una" : `quedan ${count}`);

/**
 * R3 · «Vi esto» on a ruta step: what you saw, the step that just turned face up, and the thread
 * that ties it to the rest of your films. On the last step it says the ruta is complete and
 * opens its closing screen (R4).
 */
export const RutaRevealSheet = ({ reveal, onClose }: RutaRevealSheetProps) => {
  const headingId = useId();
  const [pending, startTransition] = useTransition();
  const next = reveal?.next ?? null;
  const remaining = reveal ? reveal.total - reveal.done : 0;

  const pin = () => {
    if (!next) {
      return;
    }
    startTransition(async () => {
      const outcome = await pinTonightFromSearch({
        tmdbId: next.tmdbId,
        kind: "MOVIE",
        name: next.name,
        originalName: next.originalName,
        year: next.year,
        posterPath: next.posterPath,
      });
      if (!outcome.ok) {
        showToast({ title: "No se pudo reservar", description: outcome.error, variant: "error" });
        return;
      }
      onClose();
      pulseNav("today");
      showToast({ title: "Primera en Hoy esta noche", description: next.displayName });
    });
  };

  return (
    <Sheet
      open={Boolean(reveal)}
      onClose={onClose}
      labelledBy={headingId}
      overlayLabel="Cerrar"
      align="bottom"
      dragDismiss
      portal
    >
      {reveal ? (
        <div className="flex flex-col gap-5 px-5 pb-5 pt-3">
          <div className="flex flex-col items-center text-center">
            <SheetHandle />
            <span className="mt-1 flex size-11 items-center justify-center rounded-full bg-success-well text-success" aria-hidden="true">
              <CheckIcon />
            </span>
            <h2 id={headingId} className="mt-2 font-serif text-2xl leading-tight text-paper">
              {reveal.closed ? "Ruta completada" : reveal.seenName ? `${reveal.seenName}, vista` : "Vista"}
            </h2>
            <p className="mt-1 text-[13px] text-fog">
              {reveal.closed
                ? reveal.title
                : `Paso ${reveal.done} de ${reveal.total} · ${left(remaining)}`}
            </p>
          </div>

          <RutaProgress done={reveal.done} total={reveal.total} className="mx-auto w-full max-w-[220px]" />

          {next && !reveal.closed ? (
            <div className="flex flex-col items-center gap-2.5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {remaining === 1 ? "Se voltea la última" : "Se voltea la siguiente"}
              </p>
              <div className="ruta-flip w-[150px]">
                <PosterImage name={next.name} posterPath={next.posterPath} sizes="150px" tmdbSize="w342" className="rounded-2xl" />
              </div>
              <div>
                <p className="font-serif text-xl leading-tight text-paper">{next.displayName}</p>
                <p className="mt-0.5 text-[13px] text-fog">
                  {[next.year, formatRuntimeShort(next.runtimeMinutes), next.platformLabel].filter(Boolean).join(" · ")}
                </p>
              </div>
              <p className="max-w-[300px] text-[14px] leading-snug text-paper/85">{next.why}</p>
            </div>
          ) : null}

          {reveal.thread ? (
            <div className="rounded-2xl bg-chrome/70 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-affinity">Nuevo hilo</p>
              <p className="mt-1 text-[14px] leading-snug text-paper">{reveal.thread}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {reveal.closed ? (
              <Button href={`/rutas/${reveal.rutaId}`} size="lg" onClick={onClose}>
                Ver lo que sigue
              </Button>
            ) : next ? (
              <Button size="lg" onClick={pin} pending={pending} pendingLabel="Reservando…">
                Ver esta noche
              </Button>
            ) : null}
            <Button variant="ghost" size="md" onClick={onClose}>
              Ahora no
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
};

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
