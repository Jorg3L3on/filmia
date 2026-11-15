"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/**
 * Piezas comunes de Extras (FIL-I56-1, board S-1-sistema): result squares, the progress slot under
 * the header, the streak medallion on the seam, the pair of equal keys and the big number. Durations
 * are the variables in `globals.css`; nothing here blurs.
 */

export type SquareState = "ok" | "no" | "now" | "empty";

const squareState = (answer: boolean | undefined, index: number, current: number | null): SquareState =>
  answer === true ? "ok" : answer === false ? "no" : index === current ? "now" : "empty";

const squareSize = {
  md: "size-[1.375rem] rounded-md",
  sm: "size-[0.8125rem] rounded-[4px]",
  wide: "h-2.5 min-w-0 flex-1 rounded-full",
} as const;

/**
 * One square per answer. A hit is filled; a miss is hollow (a red outline on a dark well), so the
 * two read apart without color. `current` marks the step in play with a paper outline.
 */
export const ResultSquares = ({
  answers,
  total,
  current = null,
  size = "md",
  label,
  className,
}: {
  answers: readonly (boolean | null | undefined)[];
  total?: number;
  current?: number | null;
  size?: keyof typeof squareSize;
  label?: string;
  className?: string;
}) => {
  const count = total ?? answers.length;
  const hits = answers.filter((answer) => answer === true).length;
  return (
    <span
      role="img"
      aria-label={label ?? `${hits} de ${count}`}
      className={cn("flex", size === "wide" ? "w-full gap-1" : size === "sm" ? "flex-wrap gap-[3px]" : "flex-wrap gap-[5px]", className)}
      data-pieza="cuadritos"
    >
      {Array.from({ length: count }, (_, index) => {
        const state = squareState(answers[index] ?? undefined, index, current);
        return (
          <span
            key={index}
            className={cn(
              "juego-square shrink-0",
              squareSize[size],
              state === "ok" && "bg-success",
              state === "no" && "bg-danger-well",
              state === "now" && "bg-transparent",
              state === "empty" && "bg-chrome",
            )}
            style={
              state === "no"
                ? { boxShadow: `inset 0 0 0 ${size === "md" ? 2 : 1.5}px var(--danger)` }
                : state === "now"
                  ? { boxShadow: "inset 0 0 0 2px var(--paper)" }
                  : undefined
            }
            data-square={state}
          />
        );
      })}
    </span>
  );
};

/** The record meter: «Récord 12», a gold bar, and how far the streak is from it. */
export const RecordSlot = ({ best, current, ended = false }: { best: number; current: number; ended?: boolean }) => {
  const pct = best > 0 ? Math.min(100, Math.round((current / best) * 100)) : current > 0 ? 100 : 0;
  const line =
    current > best || (current === best && current > 0)
      ? "Nuevo récord"
      : best === 0
        ? "Estrena tu récord"
        : ended
          ? `te faltaron ${best - current}`
          : `te faltan ${best - current}`;
  return (
    <div className="flex h-6 items-center gap-2.5 whitespace-nowrap px-1 text-xs text-fog" data-pieza="ranura" data-ranura="record">
      <span>
        Récord <b className="font-semibold text-star tabular-nums">{Math.max(best, current)}</b>
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-chrome" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-star transition-[width] duration-[var(--duration-morph)] ease-[var(--ease-out)]"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={cn(line === "Nuevo récord" && "font-semibold text-star")}>{line}</span>
    </div>
  );
};

/** The daily's slot: every square visible during the whole game, and «4 de 10». */
export const SquaresSlot = ({ answers, total, label }: { answers: readonly boolean[]; total: number; label?: string }) => {
  const current = answers.length < total ? answers.length : null;
  return (
    <div className="flex h-6 items-center gap-2.5 whitespace-nowrap px-1 text-xs text-fog" data-pieza="ranura" data-ranura="cuadritos">
      <ResultSquares answers={answers} total={total} current={current} size="wide" className="flex-1" label={label} />
      <span className="tabular-nums">
        <b className="font-semibold text-paper">{Math.min(answers.length + 1, total)}</b> de {total}
      </span>
    </div>
  );
};

export type MedallionState = "normal" | "up" | "down";

/**
 * The streak (or hits) on the seam between the two cards. «up» pulses the gold ring once and shows
 * «+1»; «down» turns it red. `compact` is the 52 px form of the end screen.
 */
export const StreakMedallion = ({
  value,
  label = "racha",
  state = "normal",
  compact = false,
  className,
  style,
}: {
  value: number;
  label?: string;
  state?: MedallionState;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}) => (
  <div
    className={cn(
      "juego-medallion pointer-events-none absolute left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center justify-center rounded-full border bg-[#10141a] leading-none",
      compact ? "size-[3.25rem]" : "size-[4.75rem]",
      state === "up" ? "border-star" : state === "down" ? "border-danger" : "border-white/[0.14]",
      className,
    )}
    style={style}
    data-pieza="medallon"
    data-state={state}
    aria-live="polite"
    aria-label={`${label === "racha" ? "Racha" : "Aciertos"}: ${value}`}
  >
    <b
      key={state === "up" ? `up-${value}` : value}
      className={cn("font-serif font-semibold tabular-nums", compact ? "text-[22px]" : "text-[32px]", state === "down" ? "text-danger" : "text-star", state === "up" && "juego-medallion-pop")}
    >
      {value}
    </b>
    {compact ? null : <span className="mt-[3px] text-[9.5px] font-semibold uppercase tracking-[0.16em] text-fog">{label}</span>}
    {state === "up" ? (
      <span
        key={`plus-${value}`}
        className="juego-plus-one absolute -right-5 -top-1 flex h-6 items-center rounded-full bg-star px-2 text-[13px] font-semibold text-[#1a1403]"
        aria-hidden="true"
      >
        +1
      </span>
    ) : null}
  </div>
);

export type KeyState = "idle" | "ok" | "no" | "off";

const ArrowIcon = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0">
    <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const keyTone: Record<KeyState, string> = {
  idle: "border-white/[0.14] bg-[#1d242b] text-paper",
  ok: "border-transparent bg-success text-[#05150c]",
  no: "border-danger-line bg-danger-well text-danger",
  off: "border-white/[0.14] bg-[#1d242b] text-paper opacity-[0.38]",
};

/**
 * Two answers of equal weight; color only arrives after the answer. The labels carry the value,
 * «Menor que 8.5». Each key is at least 62 px tall (rule: 44 px or more).
 */
export const AnswerKeys = ({
  lower,
  higher,
  lowerState = "idle",
  higherState = "idle",
  disabled = false,
  onPick,
}: {
  lower: string;
  higher: string;
  lowerState?: KeyState;
  higherState?: KeyState;
  disabled?: boolean;
  onPick: (which: "menor" | "mayor") => void;
}) => {
  const key = (which: "menor" | "mayor", label: string, state: KeyState) => (
    <button
      type="button"
      onClick={() => onPick(which)}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "press-scale flex min-h-[3.875rem] min-w-0 items-center justify-center gap-2 rounded-[1.25rem] border px-2.5 text-center text-[15px] font-semibold leading-tight shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_12px_22px_-16px_rgba(0,0,0,.95)] transition-[background-color,border-color,color,opacity] duration-[var(--duration-tab)] disabled:cursor-default",
        keyTone[state],
        focusRing,
      )}
      data-pieza="tecla"
      data-key={which}
      data-state={state}
    >
      {state === "ok" ? <CheckIcon /> : state === "no" ? <CrossIcon /> : <ArrowIcon up={which === "mayor"} />}
      <span className="min-w-0 text-balance">{label}</span>
    </button>
  );
  return (
    <div className="grid grid-cols-2 gap-2.5" data-pieza="teclas">
      {key("menor", lower, lowerState)}
      {key("mayor", higher, higherState)}
    </div>
  );
};

export type BigNumberTone = "shown" | "hidden" | "counting" | "ok" | "no";

/** The number that matters, serif with tabular figures: 74 px, or 54 px for years and runtimes. */
export const BigNumber = ({
  children,
  size = "xl",
  tone = "shown",
  className,
}: {
  children: ReactNode;
  size?: "xl" | "lg" | "md";
  tone?: BigNumberTone;
  className?: string;
}) => (
  <span
    className={cn(
      "block whitespace-nowrap font-serif font-semibold leading-[0.92] tabular-nums",
      size === "xl" ? "text-[74px] tracking-[-0.03em]" : size === "lg" ? "text-[54px] tracking-[-0.02em]" : "text-[46px] tracking-[-0.02em]",
      tone === "shown" && "text-star",
      tone === "hidden" && "text-[#59626c]",
      tone === "counting" && "text-paper",
      tone === "ok" && "text-success",
      tone === "no" && "text-danger",
      className,
    )}
    data-pieza="numero"
    data-mayor-value={tone}
  >
    {children}
  </span>
);
