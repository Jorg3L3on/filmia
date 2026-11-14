"use client";

import { useState } from "react";
import { savePronosticoAction } from "@/app/actions/estrenos";
import { PosterImage } from "@/components/PosterImage";
import { RetoAvatar } from "@/components/juegos/RetosUi";
import { cn } from "@/lib/cn";
import { DEFAULT_GUESS, MAX_GUESS, MIN_GUESS, tenths } from "@/lib/juegos/estrenos/core";
import type { EstrenoCard, EstrenoForecast } from "@/lib/juegos/estrenos/store";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

/** Quiniela de estrenos (FIL-I55-1, board G-2-estrenos): one card per release. */

const Forecasts = ({ items, highlight }: { items: EstrenoForecast[]; highlight: boolean }) => (
  <ul className="mt-3 flex flex-wrap gap-x-3.5 gap-y-2" aria-label="Pronósticos de los demás">
    {items.map((item) => (
      <li key={item.userId} className="flex items-center gap-1.5 text-[13px] text-fog">
        <RetoAvatar initial={item.initial} seed={item.name} size="sm" />
        <span className="sr-only">{item.name}:</span>
        <b className={cn("tabular-nums", highlight && item.winner ? "text-success" : "text-paper")}>{tenths(item.guess)}</b>
      </li>
    ))}
  </ul>
);

const Stepper = ({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled: boolean }) => {
  const stepClass = cn(
    "flex size-11 items-center justify-center rounded-full border border-line bg-chrome text-2xl leading-none text-paper disabled:opacity-40",
    focusRing,
  );
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" className={stepClass} aria-label="Bajar una décima" disabled={disabled || value <= MIN_GUESS} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output className="w-16 text-center font-serif text-[2.25rem] font-semibold leading-none tabular-nums text-paper" aria-live="polite">
        {tenths(value)}
      </output>
      <button type="button" className={stepClass} aria-label="Subir una décima" disabled={disabled || value >= MAX_GUESS} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
};

const Card = ({ initial }: { initial: EstrenoCard }) => {
  const [card, setCard] = useState(initial);
  const [value, setValue] = useState(initial.mine ?? DEFAULT_GUESS);
  const [pending, setPending] = useState(false);
  const open = card.phase === "abierta";
  const dirty = card.mine == null || card.mine !== value;

  const save = async () => {
    setPending(true);
    try {
      const outcome = await savePronosticoAction(card.catalogId, value);
      if (!outcome.ok) {
        showActionError({ title: "No se guardó", description: outcome.error });
        return;
      }
      setCard(outcome.card);
    } catch {
      showActionError({ title: "Sin conexión", description: "Revisa tu conexión y vuelve a intentarlo." });
    } finally {
      setPending(false);
    }
  };

  const others = card.others;
  const hiddenLine =
    card.votes === 0 ? "Nadie ha votado todavía." : card.votes === 1 ? "1 persona ya votó: lo ves al guardar el tuyo." : `${card.votes} personas ya votaron: los ves al guardar el tuyo.`;

  return (
    <li
      className={cn(
        "rounded-[1.4rem] border bg-surface p-3.5",
        card.phase === "resuelta" ? "border-success/40" : open && card.mine == null ? "border-star/50" : "border-line",
      )}
      data-estreno={card.catalogId}
      data-phase={card.phase}
    >
      <div className="flex items-start gap-3">
        <span className="relative h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-lg">
          <PosterImage name={card.name} posterPath={card.posterPath} sizes="48px" tmdbSize="w185" ratio="fill" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <b className="line-clamp-2 text-base font-semibold leading-snug text-paper">{card.name}</b>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
                card.phase === "resuelta" ? "border-success/50 bg-success/15 text-success" : open ? "border-star/50 bg-star/10 text-star" : "border-line bg-chrome text-fog",
              )}
            >
              {card.chip}
            </span>
          </div>
          {card.phase === "resuelta" && card.actual != null ? (
            <p className="text-sm text-fog">
              Quedó en <b className="text-paper">{tenths(card.actual)}</b>.{" "}
              {card.mine == null
                ? `No votaste. Más cerca: ${card.winners.join(", ") || "nadie"}.`
                : card.iWon
                  ? `Tú dijiste ${tenths(card.mine)}: ${
                      card.winners.length > 1 ? `empate con ${card.winners.filter((name) => name !== "Tú").join(", ")}, lo más cerca` : "lo más cerca de todos"
                    }.`
                  : `Tú dijiste ${tenths(card.mine)}. Más cerca: ${card.winners.join(", ")}.`}
            </p>
          ) : !open ? (
            <p className="text-sm text-fog">
              {card.mine == null ? "No votaste en esta." : `Tu pronóstico: ${tenths(card.mine)}.`}{" "}
              {card.phase === "pendiente" ? "IMDb aún no tiene su nota; se revisa cada día." : null}
            </p>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <Stepper value={value} onChange={setValue} disabled={pending} />
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className={buttonClass({ variant: dirty ? "primary" : "secondary", size: "md", pending })}
            data-estrenos="guardar"
          >
            {card.mine == null ? "Guardar" : dirty ? "Cambiar" : "Guardado"}
          </button>
        </div>
      ) : null}

      {card.revealed ? (
        others.length > 0 ? (
          <Forecasts items={others} highlight={card.phase === "resuelta"} />
        ) : card.mine != null && open ? (
          <p className="mt-3 text-[13px] text-fog">Eres la primera persona en votar.</p>
        ) : null
      ) : (
        <p className="mt-3 text-[13px] text-fog" data-estrenos="ocultos">
          {hiddenLine}
        </p>
      )}
    </li>
  );
};

export const EstrenosGame = ({ cards }: { cards: EstrenoCard[] }) => (
  <ul className="flex flex-col gap-2.5">
    {cards.map((card) => (
      <Card key={card.catalogId} initial={card} />
    ))}
  </ul>
);
