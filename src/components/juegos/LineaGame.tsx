"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { placeLineaCard } from "@/app/actions/diarias";
import { MayorTopBar } from "@/components/juegos/MayorGame";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { gapLabel } from "@/lib/juegos/diarias/linea";
import type { LineaView } from "@/lib/juegos/diarias/linea-store";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

const Heart = ({ full }: { full: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-5", full ? "fill-danger text-danger" : "fill-none text-danger/40")} stroke="currentColor" strokeWidth={full ? 0 : 2}>
    <path d="M12 21s-7.5-4.6-9.5-9.2C1 8 3.2 4.5 6.6 4.5c2 0 3.6 1.1 5.4 3.1 1.8-2 3.4-3.1 5.4-3.1 3.4 0 5.6 3.5 4.1 7.3C19.5 16.4 12 21 12 21z" />
  </svg>
);

export const Hearts = ({ lives, max }: { lives: number; max: number }) => (
  <span className="flex shrink-0 gap-1" aria-label={`Te quedan ${lives} de ${max} vidas`} data-linea="vidas">
    {Array.from({ length: max }, (_, index) => (
      <Heart key={index} full={index < lives} />
    ))}
  </span>
);

/** One film on the line: year, small poster, name; a misplaced card is marked. */
export const LineaItem = ({ item }: { item: LineaView["line"][number] }) => (
  <li className="relative flex min-h-[3.75rem] items-center gap-3 before:absolute before:-left-[1.5625rem] before:top-1/2 before:size-2.5 before:-translate-y-1/2 before:rounded-full before:bg-paper">
    <span className={cn("w-12 shrink-0 font-serif text-[1.15rem] font-semibold tabular-nums", item.ok === false ? "text-danger" : "text-paper")}>{item.year}</span>
    <span className="block h-[3.1875rem] w-[2.125rem] shrink-0 overflow-hidden rounded-md">
      <PosterImage name={item.name} posterPath={item.posterPath} sizes="34px" tmdbSize="w185" ratio="fill" />
    </span>
    <b className="min-w-0 flex-1 truncate text-[15px] font-semibold text-paper">{item.name}</b>
    {item.ok === false ? <span className="shrink-0 text-xs font-semibold text-danger">−1 vida</span> : null}
  </li>
);

/**
 * Línea de tiempo's play screen (board J-2-linea): the card to place on top, the line below with a
 * gap between every two films. Tap (or Enter on) a gap to choose it, then «Colocar aquí» confirms:
 * no dragging needed. The server says the year only after the card is placed.
 */
export const LineaGame = ({ initialView }: { initialView: LineaView }) => {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [gap, setGap] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{ name: string; year: number; correct: boolean } | null>(null);

  const place = () => {
    if (gap == null || pending || !view.card) return;
    setPending(true);
    const name = view.card.name;
    placeLineaCard(view.partidaId, view.step, gap)
      .then((outcome) => {
        if (!outcome.ok) {
          if (outcome.view) setView(outcome.view);
          showActionError({ title: outcome.error });
          return;
        }
        setLast({ name, year: outcome.year, correct: outcome.correct });
        setView(outcome.view);
        setGap(null);
      })
      .catch(() => showActionError({ title: "No se pudo colocar", description: "Revisa tu conexión e intenta otra vez." }))
      .finally(() => setPending(false));
  };

  return (
    <div className="flex flex-1 flex-col gap-4" data-linea="juego">
      <MayorTopBar
        eyebrow={view.finished ? `La diaria · n.º ${view.number}` : `n.º ${view.number} · carta ${view.cardNumber} de ${view.total}`}
        title="Línea de tiempo"
        backHref={JUEGOS_PATH}
        chip={<Hearts lives={view.lives} max={view.maxLives} />}
      />

      {last ? (
        <p className={cn("rounded-xl px-3 py-2 text-sm font-semibold", last.correct ? "bg-success/10 text-success" : "bg-danger/10 text-danger")} role="status" data-linea="aviso">
          {last.correct ? `¡Bien! ${last.name} es de ${last.year}.` : `${last.name} es de ${last.year}: pierdes una vida.`}
        </p>
      ) : null}

      {view.card ? (
        <div className="flex items-center gap-3.5 rounded-[1.4rem] border border-accent/40 bg-[#171c21] p-3" data-linea="carta">
          <span className="block h-[5.25rem] w-14 shrink-0 overflow-hidden rounded-lg">
            <PosterImage name={view.card.name} posterPath={view.card.posterPath} sizes="56px" tmdbSize="w185" ratio="fill" priority />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">¿Dónde va?</span>
            <b className="line-clamp-2 text-[1.05rem] font-semibold leading-tight text-paper">{view.card.name}</b>
            <span className="text-sm text-fog">Toca el hueco de su año.</span>
          </div>
        </div>
      ) : null}

      <ol className="relative ml-1 pl-[2.125rem] before:absolute before:bottom-1.5 before:left-3.5 before:top-1.5 before:w-0.5 before:bg-line" aria-label="La línea" data-linea="linea">
        {view.line.map((item, index) => (
          <Fragment key={`${item.year}`}>
            {view.card ? (
              <li>
                <button
                  type="button"
                  aria-pressed={gap === index}
                  onClick={() => setGap(index)}
                  className={cn(
                    "my-0.5 flex min-h-11 w-full items-center rounded-[0.625rem] border-[1.5px] border-dashed px-3 text-left text-[13px]",
                    gap === index ? "border-accent bg-accent/10 font-semibold text-accent" : "border-line text-fog",
                    focusRing,
                  )}
                  data-linea-hueco={index}
                >
                  {gapLabel(view.line, index)}
                  {gap === index ? " · aquí" : ""}
                </button>
              </li>
            ) : null}
            <LineaItem item={item} />
          </Fragment>
        ))}
        {view.card ? (
          <li>
            <button
              type="button"
              aria-pressed={gap === view.line.length}
              onClick={() => setGap(view.line.length)}
              className={cn(
                "my-0.5 flex min-h-11 w-full items-center rounded-[0.625rem] border-[1.5px] border-dashed px-3 text-left text-[13px]",
                gap === view.line.length ? "border-accent bg-accent/10 font-semibold text-accent" : "border-line text-fog",
                focusRing,
              )}
              data-linea-hueco={view.line.length}
            >
              {gapLabel(view.line, view.line.length)}
              {gap === view.line.length ? " · aquí" : ""}
            </button>
          </li>
        ) : null}
      </ol>

      <div className="flex-1" />
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-canvas via-canvas to-transparent px-4 pb-2 pt-4">
        {view.finished ? (
          <button type="button" onClick={() => router.refresh()} className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}>
            Ver resultado
          </button>
        ) : (
          <button
            type="button"
            disabled={gap == null || pending}
            onClick={place}
            className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}
            data-linea="colocar"
          >
            {gap == null ? "Elige un hueco" : "Colocar aquí"}
          </button>
        )}
      </div>
    </div>
  );
};
