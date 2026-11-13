"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { answerDetalleStep } from "@/app/actions/diarias";
import { DiariaTitleSearch } from "@/components/juegos/DiariaTitleSearch";
import { LensChip, MayorTopBar } from "@/components/juegos/MayorGame";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import type { TitleGuess } from "@/lib/juegos/diarias/core";
import { DETALLE_LEVELS, DETALLE_POSTERS } from "@/lib/juegos/diarias/detalle";
import type { DetallePosterView, DetalleView } from "@/lib/juegos/diarias/detalle-store";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass } from "@/lib/ui";

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-4 shrink-0">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/** The six crop steps: used (a miss), the one on screen, still closed. */
const Steps = ({ level }: { level: number }) => (
  <div className="flex justify-center gap-1.5" aria-label={`Recorte ${level} de ${DETALLE_LEVELS}`} data-detalle="pasos">
    {Array.from({ length: DETALLE_LEVELS }, (_, index) => (
      <span key={index} className={cn("h-1.5 w-[2.125rem] rounded-full", index + 1 < level ? "bg-danger" : index + 1 === level ? "bg-paper" : "bg-chrome")} />
    ))}
  </div>
);

/** A poster that just ended: what it was and what it gave. */
const Reveal = ({ poster }: { poster: DetallePosterView }) => (
  <div className="flex flex-col items-center gap-3 text-center" data-detalle="revelado">
    <span className="block w-[10.5rem] overflow-hidden rounded-2xl shadow-[0_26px_50px_-22px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,.08)]">
      <PosterImage name={poster.reveal?.name ?? ""} posterPath={poster.reveal?.posterPath ?? null} sizes="168px" tmdbSize="w342" priority />
    </span>
    <p className={cn("text-sm font-semibold", poster.status === "solved" ? "text-success" : "text-danger")}>
      {poster.status === "solved" ? `¡Era! +${poster.points} ${poster.points === 1 ? "punto" : "puntos"}` : "Esta no salió"}
    </p>
    <p className="font-serif text-[1.35rem] font-semibold leading-tight text-paper">
      {poster.reveal?.name ?? "Película"}
      {poster.reveal?.year ? <span className="ml-2 text-base font-normal text-fog">{poster.reveal.year}</span> : null}
    </p>
  </div>
);

/**
 * Detalle's play screen (board D-2-detalle): the crop the server cut for the current poster and
 * level, the six steps, the wrong guesses and the title search. Every guess goes to the server;
 * the poster arrives only after it is solved or failed. When the third poster ends, «Ver
 * resultado» refreshes the page into the day table.
 */
export const DetalleGame = ({ initialView }: { initialView: DetalleView }) => {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  /** The poster that just ended, shown until «Siguiente». */
  const [ended, setEnded] = useState<DetallePosterView | null>(null);
  const [pending, setPending] = useState(false);

  const current = view.current == null ? null : view.posters[view.current]!;

  const send = (guess: TitleGuess | null) => {
    if (pending || !current) return;
    setPending(true);
    const before = current.index;
    answerDetalleStep(view.partidaId, view.step, guess)
      .then((outcome) => {
        if (!outcome.ok) {
          if (outcome.view) setView(outcome.view);
          showActionError({ title: outcome.error });
          return;
        }
        const after = outcome.view.posters[before]!;
        if (after.status === "solved" || after.status === "failed") setEnded(after);
        setView(outcome.view);
      })
      .catch(() => showActionError({ title: "No se pudo enviar", description: "Revisa tu conexión e intenta otra vez." }))
      .finally(() => setPending(false));
  };

  const eyebrow = `n.º ${view.number} · póster ${Math.min((view.current ?? DETALLE_POSTERS - 1) + 1, DETALLE_POSTERS)} de ${DETALLE_POSTERS}`;

  return (
    <div className="flex flex-1 flex-col gap-5" data-detalle="juego">
      <MayorTopBar eyebrow={eyebrow} title="Detalle" backHref={JUEGOS_PATH} chip={<LensChip>{view.score} pts</LensChip>} />

      {ended ? (
        <>
          <Reveal poster={ended} />
          <div className="flex-1" />
          {view.finished ? (
            <button type="button" onClick={() => router.refresh()} className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}>
              Ver resultado
            </button>
          ) : (
            <button type="button" onClick={() => setEnded(null)} className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })} autoFocus>
              Siguiente póster
            </button>
          )}
        </>
      ) : current ? (
        <>
          <div className="mx-auto size-[15.625rem] max-w-full overflow-hidden rounded-[1.4rem] bg-chrome shadow-[0_30px_60px_-24px_rgba(0,0,0,.9),0_0_0_1px_rgba(255,255,255,.08)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a server-cut crop, private and never optimized. */}
            <img
              key={`${current.index}-${current.level}`}
              src={`/extras/detalle/recorte/${view.partidaId}?p=${current.index}&n=${current.level}`}
              alt={`Recorte ${current.level} de ${DETALLE_LEVELS} de un póster`}
              width={250}
              height={250}
              className="size-full object-cover"
              data-detalle="recorte"
            />
          </div>
          <Steps level={current.level} />
          <p className="-mt-2 text-center text-sm text-fog">
            {current.level === 1 ? "Cada fallo abre más el recorte. Menos recortes, más puntos." : `Recorte ${current.level} de ${DETALLE_LEVELS}: vale ${DETALLE_LEVELS + 1 - current.level}.`}
          </p>
          {current.misses.length > 0 ? (
            <ul className="flex flex-col gap-1.5" aria-label="Lo que no era" data-detalle="fallos">
              {current.misses.map((name, index) => (
                <li key={`${name}-${index}`} className="flex min-h-10 items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.06] px-3 text-sm text-mist">
                  <span className="text-danger">
                    <XIcon />
                  </span>
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <DiariaTitleSearch placeholder="¿Qué película es?" disabled={pending} onPick={send} />
          <div className="flex-1" />
          <button
            type="button"
            disabled={pending}
            onClick={() => send(null)}
            className={buttonClass({ variant: "secondary", size: "lg", className: "w-full" })}
            data-detalle="no-se"
          >
            {current.level >= DETALLE_LEVELS ? "No sé, ver cuál era" : "No sé, ábrelo más"}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => router.refresh()} className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}>
          Ver resultado
        </button>
      )}
    </div>
  );
};
