"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { activateRuta, parkRuta, rutaAfterWatch, startRuta } from "@/app/actions/rutas";
import { markTmdbTitleWatched } from "@/app/actions/title-preview";
import { pinTonightFromSearch } from "@/app/actions/tonight";
import { Button } from "@/components/Button";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { RutaRevealSheet } from "@/components/rutas/RutaRevealSheet";
import type { RutaOffer } from "@/lib/rutas/factories";
import type { RutaReveal, RutaStepCard } from "@/lib/rutas/reveal";
import { cn } from "@/lib/cn";
import { pulseNav } from "@/lib/fly-to-nav";
import { showToast } from "@/lib/toast";
import { focusRing } from "@/lib/ui";

/**
 * The next step on the ruta page (R2): «Ver esta noche» or «Ya la vi». «Ya la vi» opens the same
 * Marqué visto sheet as everywhere else (nota, fecha, dónde); once saved, the one after flips.
 */
export const RutaStepActions = ({ rutaId, step }: { rutaId: string; step: RutaStepCard }) => {
  const router = useRouter();
  const [pending, setPending] = useState<"pin" | null>(null);
  const [seenOpen, setSeenOpen] = useState(false);
  const [reveal, setReveal] = useState<RutaReveal | null>(null);
  const [, startTransition] = useTransition();
  const film = {
    tmdbId: step.tmdbId,
    kind: "MOVIE" as const,
    name: step.name,
    originalName: step.originalName,
    year: step.year,
    posterPath: step.posterPath,
  };

  const pin = () => {
    setPending("pin");
    startTransition(async () => {
      const outcome = await pinTonightFromSearch(film);
      setPending(null);
      if (!outcome.ok) {
        showToast({ title: "No se pudo reservar", description: outcome.error, variant: "error" });
        return;
      }
      pulseNav("today");
      showToast({ title: "Primera en Hoy esta noche", description: step.displayName });
    });
  };

  const saveSeen = async (formData: FormData) => {
    const outcome = await markTmdbTitleWatched(film, formData);
    if (!outcome.ok) {
      throw new Error(outcome.error);
    }
    const next = await rutaAfterWatch(rutaId, step.catalogId).catch(() => null);
    if (next) {
      setReveal(next);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={pin} pending={pending === "pin"} disabled={pending != null}>
          Ver esta noche
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setSeenOpen(true)} disabled={pending != null}>
          Ya la vi
        </Button>
      </div>
      <MarkWatchedSheet
        open={seenOpen}
        titleId={step.titleId ?? `preview:MOVIE:${step.tmdbId}`}
        titleName={step.displayName}
        saveLabel="Guardar en el diario"
        silent
        onClose={() => setSeenOpen(false)}
        submit={saveSeen}
      />
      <RutaRevealSheet
        reveal={reveal}
        onClose={() => {
          setReveal(null);
          router.refresh();
        }}
      />
    </>
  );
};

/** «Dejar para después» on an active ruta, «Seguir en Hoy» on a waiting one. */
export const RutaStatusAction = ({ rutaId, status }: { rutaId: string; status: "activa" | "espera" }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      if (status === "activa") {
        await parkRuta(rutaId);
        showToast({ title: "Ruta para después", description: "Sale de Hoy y te espera aquí." });
      } else {
        const ok = await activateRuta(rutaId);
        showToast(
          ok
            ? { title: "De vuelta en Hoy", description: "La verás como una lente más." }
            : { title: "Hoy ya tiene dos rutas", description: "Deja una para después y vuelve a intentarlo." },
        );
      }
      router.refresh();
    });
  return (
    <Button size="sm" variant="ghost" onClick={run} pending={pending}>
      {status === "activa" ? "Dejar para después" : "Seguir en Hoy"}
    </Button>
  );
};

/** The rutas on offer (R4 «Se abren dos rutas», the rutas page): one tap starts one. */
export const RutaOfferList = ({ offers, className }: { offers: RutaOffer[]; className?: string }) => {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const start = (offer: RutaOffer) => {
    setPendingKey(offer.sourceKey);
    startTransition(async () => {
      const outcome = await startRuta(offer.sourceKey);
      setPendingKey(null);
      if (!outcome.ok) {
        showToast({ title: "No se pudo empezar", description: outcome.error, variant: "error" });
        return;
      }
      if (outcome.status === "espera") {
        showToast({ title: "Espera su turno", description: "Hoy ya tiene dos rutas; esta empieza cuando cierres una." });
      }
      router.push(`/rutas/${outcome.rutaId}`);
    });
  };
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {offers.map((offer) => (
        <li key={offer.sourceKey}>
          <button
            type="button"
            onClick={() => start(offer)}
            disabled={pendingKey != null}
            aria-busy={pendingKey === offer.sourceKey || undefined}
            className={cn(
              "press-scale flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left disabled:opacity-60",
              focusRing,
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-accent/60 text-[13px] font-semibold text-accent-hover">
              {offer.total}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-[17px] leading-tight text-paper">{offer.title}</span>
              <span className="block truncate text-[12px] text-fog">
                {offer.done > 0 ? `Llevas ${offer.done} de ${offer.total}` : `${offer.total} películas`}
                {offer.next ? ` · sigue ${offer.next.name}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-medium text-accent-hover">
              {pendingKey === offer.sourceKey ? "…" : "Empezar"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
