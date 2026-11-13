"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { answerGustosPair } from "@/app/actions/retos";
import { MayorTopBar, Squares } from "@/components/juegos/MayorGame";
import { RetoAvatar } from "@/components/juegos/RetosUi";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { DUELOS_PATH } from "@/lib/juegos/retos/core";
import type { GustosCard, GustosView } from "@/lib/juegos/retos/gustos";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

type Reveal = { pick: string; correct: boolean; ra: number; rb: number; pair: { a: GustosCard; b: GustosCard } };

/**
 * Duelo de gustos (FIL-I53-6, board D-3-gustos): two films the other person rated; which one did
 * they like more? No rating shows before the answer; after it, both of theirs.
 */
export const GustosGame = ({ initialView, rival }: { initialView: GustosView; rival: { name: string; initial: string } }) => {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [pending, setPending] = useState(false);

  const pair = reveal?.pair ?? view.pair;

  const pick = async (catalogId: string) => {
    if (!view.pair || pending || reveal) return;
    setPending(true);
    try {
      const outcome = await answerGustosPair(view.partidaId, view.index, catalogId);
      if (!outcome.ok) {
        if (outcome.view) setView(outcome.view);
        showActionError({ title: "No se pudo contestar", description: outcome.error });
        return;
      }
      setReveal({ pick: catalogId, correct: outcome.correct, ra: outcome.ra, rb: outcome.rb, pair: view.pair });
      setView(outcome.view);
    } catch {
      showActionError({ title: "Sin conexión", description: "Tu duelo sigue guardado. Vuelve a intentarlo." });
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (!view.finished) return;
    const timer = window.setTimeout(() => router.refresh(), reveal ? 1800 : 0);
    return () => window.clearTimeout(timer);
  }, [view.finished, reveal, router]);

  const card = (film: GustosCard, rating: number | null, winner: boolean | null) => (
    <button
      key={film.catalogId}
      type="button"
      onClick={() => pick(film.catalogId)}
      disabled={pending || reveal != null || view.cancelled}
      className={cn("flex min-w-0 flex-col items-center gap-2 rounded-2xl p-1 text-center", winner === false && "opacity-55", focusRing)}
      data-gustos-carta={film.catalogId}
    >
      <span
        className={cn(
          "block aspect-[2/3] w-full overflow-hidden rounded-2xl shadow-[0_26px_50px_-22px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,.08)]",
          winner === true && "ring-[3px] ring-success",
        )}
      >
        <PosterImage name={film.name} posterPath={film.posterPath} sizes="170px" tmdbSize="w342" ratio="fill" priority />
      </span>
      <span className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-tight text-paper">{film.name}</span>
      {rating != null ? (
        <>
          <span className={cn("font-serif text-[1.9rem] font-semibold leading-none tabular-nums", winner ? "text-success" : "text-fog")}>{rating}</span>
          <span className="text-xs text-fog">la nota de {rival.name}</span>
        </>
      ) : null}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col gap-4" data-gustos={view.cancelled ? "cancelado" : view.finished ? "fin" : reveal ? "contestado" : "par"}>
      <MayorTopBar
        eyebrow={`Par ${Math.min(view.index + (reveal ? 0 : 1), view.total)} de ${view.total} · llevas ${view.score}`}
        title="Duelo de gustos"
        backHref={DUELOS_PATH}
        backLabel="Salir del duelo"
        chip={<RetoAvatar initial={rival.initial} seed={rival.name} size="md" />}
      />
      {view.cancelled ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-4 text-[15px] text-fog">
          Este duelo se canceló: alguien dejó de compartir sus notas en juegos. No cuenta para nadie.
        </p>
      ) : pair ? (
        <>
          <p className="font-serif text-[1.55rem] font-semibold leading-tight text-paper">
            ¿Cuál le gustó más a <span className="italic text-affinity">{rival.name}</span>?
          </p>
          <div className="relative grid grid-cols-2 items-start gap-3.5">
            {card(pair.a, reveal ? reveal.ra : null, reveal ? reveal.ra > reveal.rb : null)}
            {card(pair.b, reveal ? reveal.rb : null, reveal ? reveal.rb > reveal.ra : null)}
          </div>
        </>
      ) : null}
      <div className="flex-1" />
      {reveal ? (
        <p className="text-center text-sm text-fog" aria-live="polite">
          {reveal.correct ? "Acertaste." : `No: ${rival.name} prefirió la otra.`}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
        <span className="text-sm text-fog">Tú adivinando a {rival.name}</span>
        <Squares answers={view.answered.map((item) => item.correct)} total={view.total} small />
      </div>
      {view.finished ? (
        <p className="pb-2 text-center text-sm text-fog">Contando tus aciertos…</p>
      ) : reveal ? (
        <button type="button" onClick={() => setReveal(null)} className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })} data-gustos="siguiente">
          Siguiente par
        </button>
      ) : null}
    </div>
  );
};
