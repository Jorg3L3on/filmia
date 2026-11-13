"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { answerCuadriculaCell } from "@/app/actions/diarias";
import { DiariaTitleSearch } from "@/components/juegos/DiariaTitleSearch";
import { LensChip, MayorTopBar } from "@/components/juegos/MayorGame";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { RARITY_MIN_PLAYERS } from "@/lib/juegos/diarias/cuadricula";
import type { TitleGuess } from "@/lib/juegos/diarias/core";
import type { CuadriculaView } from "@/lib/juegos/diarias/cuadricula-store";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

/**
 * The 3 × 3 grid: conditions on top, people on the left. A filled cell shows its poster and, from
 * five players up, the share of players who gave the same film. `onPick` makes empty cells
 * buttons (the play screen); without it the grid is read-only (the result).
 */
export const CuadriculaGrid = ({ view, selected, onPick }: { view: CuadriculaView; selected?: number | null; onPick?: (cell: number) => void }) => (
  <div className="grid grid-cols-[4.75rem_repeat(3,minmax(0,1fr))] gap-[0.4375rem]" data-cuadricula="cuadricula">
    <span />
    {view.cols.map((col) => (
      <span key={col.label} className="flex min-h-[3.25rem] items-center justify-center rounded-xl px-1 text-center text-[11.5px] font-semibold leading-tight text-mist">
        {col.label}
      </span>
    ))}
    {view.rows.map((row, rowIndex) => (
      <Fragment key={row.name}>
        <span className="flex items-center text-[12px] font-semibold leading-tight text-paper">
          <span className="line-clamp-3 [overflow-wrap:anywhere]">{row.name}</span>
        </span>
        {[0, 1, 2].map((col) => {
          const cell = view.cells[rowIndex * 3 + col]!;
          const label = `${row.name} · ${view.cols[col]!.label}`;
          if (cell.film) {
            return (
              <span key={col} className="relative aspect-[2/3] overflow-hidden rounded-xl border border-success/40" aria-label={`${label}: ${cell.film.name}`} data-cuadricula-casilla={cell.index}>
                <PosterImage name={cell.film.name} posterPath={cell.film.posterPath} sizes="90px" tmdbSize="w185" ratio="fill" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-4 text-[10.5px] font-semibold leading-tight text-paper">
                  <span className="line-clamp-2">{cell.film.name}</span>
                  {cell.film.rarity != null ? <span className="text-star">{cell.film.rarity} %</span> : null}
                </span>
              </span>
            );
          }
          const active = selected === cell.index;
          return onPick && !view.finished ? (
            <button
              key={col}
              type="button"
              aria-pressed={active}
              aria-label={`${label}: vacía`}
              onClick={() => onPick(cell.index)}
              className={cn(
                "grid aspect-[2/3] place-items-center rounded-xl border px-1 text-center text-[11px] leading-tight",
                active ? "border-accent bg-accent/10 font-semibold text-accent" : "border-line bg-surface text-faint",
                focusRing,
              )}
              data-cuadricula-casilla={cell.index}
            >
              {active ? "Responde abajo" : "Toca"}
            </button>
          ) : (
            <span key={col} className="grid aspect-[2/3] place-items-center rounded-xl border border-dashed border-line text-fog" aria-label={`${label}: vacía`} data-cuadricula-casilla={cell.index}>
              —
            </span>
          );
        })}
      </Fragment>
    ))}
  </div>
);

/** Rarity panel: the total, or «pocos datos» below five players. */
export const RarityPanel = ({ view }: { view: CuadriculaView }) => (
  <div className="rounded-2xl border border-line bg-surface px-3.5 py-3" data-cuadricula="rareza">
    <div className="flex items-center justify-between gap-3">
      <b className="text-[15px] font-semibold text-paper">Tu rareza</b>
      {view.rarity != null ? (
        <span className="font-serif text-2xl font-semibold tabular-nums text-star">{view.rarity}</span>
      ) : (
        <span className="text-sm font-semibold text-fog">Pocos datos</span>
      )}
    </div>
    <p className="mt-1 text-sm leading-snug text-fog">
      {view.rarity != null
        ? "Suma el porcentaje de gente que dio tu misma respuesta en cada casilla (100 si quedó vacía). Mientras más bajo, mejor."
        : `La rareza sale cuando jueguen ${RARITY_MIN_PLAYERS} personas; hoy van ${view.players}.`}
    </p>
  </div>
);

/**
 * La cuadrícula's play screen (board J-1-cuadricula): tap an empty cell, then name a film in the
 * search. Right or wrong spends one of nine tries; a film already in another cell is refused
 * without spending one. «Ver resultado» refreshes into the day table.
 */
export const CuadriculaGame = ({ initialView }: { initialView: CuadriculaView }) => {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [cell, setCell] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);

  const left = view.maxTries - view.tries;
  const target = cell == null ? null : { row: view.rows[Math.floor(cell / 3)]!, col: view.cols[cell % 3]! };

  const send = (guess: TitleGuess) => {
    if (cell == null || pending) return;
    setPending(true);
    answerCuadriculaCell(view.partidaId, view.step, cell, guess)
      .then((outcome) => {
        if (!outcome.ok) {
          if (outcome.view) setView(outcome.view);
          setLast({ ok: false, text: outcome.error });
          return;
        }
        setLast({ ok: outcome.correct, text: outcome.correct ? `¡Sí! ${guess.name} entra.` : `${guess.name} no va ahí. Se gasta un intento.` });
        setView(outcome.view);
        if (outcome.correct) setCell(null);
      })
      .catch(() => showActionError({ title: "No se pudo enviar", description: "Revisa tu conexión e intenta otra vez." }))
      .finally(() => setPending(false));
  };

  return (
    <div className="flex flex-1 flex-col gap-4" data-cuadricula="juego">
      <MayorTopBar
        eyebrow={`La diaria · n.º ${view.number}`}
        title="La cuadrícula"
        backHref={JUEGOS_PATH}
        chip={<LensChip>{view.finished ? `${view.score} de 9` : left === 1 ? "1 intento" : `${left} intentos`}</LensChip>}
      />
      <CuadriculaGrid view={view} selected={cell} onPick={view.finished ? undefined : (index) => setCell(index)} />
      {last ? (
        <p className={cn("rounded-xl px-3 py-2 text-sm font-semibold", last.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")} role="status" data-cuadricula="aviso">
          {last.text}
        </p>
      ) : null}
      {view.finished ? (
        <>
          <div className="flex-1" />
          <button type="button" onClick={() => router.refresh()} className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })} autoFocus>
            Ver resultado
          </button>
        </>
      ) : (
        <>
          {target ? (
            <DiariaTitleSearch
              key={cell}
              placeholder={`Una de ${target.row.name} ${target.col.short}`}
              label={`Película de ${target.row.name}: ${target.col.label}`}
              disabled={pending}
              onPick={send}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-3.5 py-3 text-sm text-fog">Toca una casilla vacía para responder.</p>
          )}
          <RarityPanel view={view} />
        </>
      )}
    </div>
  );
};
