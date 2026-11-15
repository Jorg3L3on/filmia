"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { answerMayorStep, startMayorFree } from "@/app/actions/juegos";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import {
  AnswerKeys,
  BigNumber,
  RecordSlot,
  ResultSquares,
  SquaresSlot,
  StreakMedallion,
  type BigNumberTone,
  type KeyState,
  type MedallionState,
} from "@/components/juegos/Piezas";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { dailyNumber, MAYOR_LENS_IDS, MAYOR_LENSES, MAYOR_PATH, type MayorGuess, type MayorLensId } from "@/lib/juegos/mayor/core";
import type { MayorAnswerOutcome, MayorStep, MayorView } from "@/lib/juegos/mayor/store";
import { RETAR_PATH, suddenDeathTrack } from "@/lib/juegos/retos/core";
import { usePrefersReducedMotion } from "@/lib/motion";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

/** How long the revealed value stays before the next pair (after the count ends). */
const HOLD_MS = 900;
/** The count: 70 ms per unit (a tenth of IMDb), never longer than 600 ms. */
const COUNT_STEP_MS = 70;
const COUNT_MAX_MS = 600;

type Reveal = { value: string; correct: boolean };
type Phase = "idle" | "waiting" | "counting" | "revealed";

export const MayorTopBar = ({
  eyebrow,
  title,
  chip,
  backHref = JUEGOS_PATH,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  chip?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) => (
  <div className="flex items-center gap-3">
    <Link
      href={backHref}
      aria-label={backLabel ?? (backHref === JUEGOS_PATH ? "Volver a Extras" : "Volver a Mayor o menor")}
      className={cn("relative flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-paper", focusRing)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-accent" data-mayor="eyebrow">
        {eyebrow}
      </p>
      <h1 className="truncate font-serif text-[1.45rem] font-semibold leading-tight text-paper">{title}</h1>
    </div>
    {chip}
  </div>
);

export const LensChip = ({ children }: { children: ReactNode }) => (
  <span className="shrink-0 rounded-full border border-line bg-chrome px-2.5 py-1 text-xs font-semibold text-fog">{children}</span>
);

/** Small squares, one per answer: a hit filled, a miss hollow (FIL-I56-1). */
export const Squares = ({ answers, total, small = false }: { answers: readonly boolean[]; total?: number; small?: boolean }) => (
  <ResultSquares answers={answers} total={total} size={small ? "sm" : "md"} />
);

// ---------------------------------------------------------------------------
// Numbers per lens: what the keys say, how the count runs and how the delta reads.
// ---------------------------------------------------------------------------

/** «2 h 10 min» → 130. */
const parseRuntime = (text: string) => {
  const hours = /(\d+)\s*h/.exec(text)?.[1];
  const minutes = /(\d+)\s*min/.exec(text)?.[1];
  return (hours ? Number(hours) * 60 : 0) + (minutes ? Number(minutes) : 0);
};

/** The value as a count: tenths for IMDb, units otherwise. */
const unitsOf = (lens: MayorLensId, text: string): number | null => {
  const value = lens === "runtime" ? parseRuntime(text) : Number.parseFloat(text);
  if (!Number.isFinite(value)) return null;
  return lens === "imdb" ? Math.round(value * 10) : Math.round(value);
};

const formatUnits = (lens: MayorLensId, units: number) => {
  if (lens === "imdb") return (units / 10).toFixed(1);
  return lens === "runtime" ? MAYOR_LENSES.runtime.format(units) : String(units);
};

/** «Menor que 8.5», «Antes de 2019», «Más de 2 h 10 min». */
export const keyLabels = (lens: MayorLensId, value: string): { lower: string; higher: string } => {
  // «1 h 58 min» never breaks inside: the key wraps before it instead.
  const reference = value.replace(/ /g, "\u00a0");
  if (lens === "imdb") return { lower: `Menor que ${reference}`, higher: `Mayor que ${reference}` };
  if (lens === "year") return { lower: `Antes de ${reference}`, higher: `Después de ${reference}` };
  return { lower: `Menos de ${reference}`, higher: `Más de ${reference}` };
};

/** «▲ +0.2», «▼ −3 años», «▲ +12 min». */
const deltaText = (lens: MayorLensId, from: number, to: number) => {
  const diff = to - from;
  const size = Math.abs(diff);
  const amount = lens === "imdb" ? (size / 10).toFixed(1) : lens === "year" ? `${size} ${size === 1 ? "año" : "años"}` : lens === "runtime" ? `${size} min` : String(size);
  return `${diff > 0 ? "▲ +" : "▼ −"}${amount}`;
};

/** A runtime keeps its units small so «2 h 10» fits the card at 54 px. */
const ValueText = ({ lens, text }: { lens: MayorLensId; text: string }) => {
  if (lens !== "runtime" || text === "?") return <>{text}</>;
  const parts = text.split(/\s+/);
  return (
    <>
      {parts.map((part, index) =>
        /^\d+$/.test(part) ? (
          <span key={index}>{part}</span>
        ) : (
          <span key={index} className="ml-0.5 mr-1.5 text-[0.42em] font-semibold tracking-normal text-current/80 last:mr-0">
            {part}
          </span>
        ),
      )}
    </>
  );
};

/** Runs the count from `from` to `to` units; resolves when it lands (at once with reduced motion). */
const useCount = () => {
  const frame = useRef<number | null>(null);
  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);
  return (from: number, to: number, reduced: boolean, onTick: (units: number) => void) =>
    new Promise<void>((resolve) => {
      const steps = Math.abs(to - from);
      const duration = reduced ? 0 : Math.min(COUNT_STEP_MS * steps, COUNT_MAX_MS);
      if (duration === 0 || steps === 0) {
        onTick(to);
        resolve();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        onTick(Math.round(from + (to - from) * t));
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else resolve();
      };
      frame.current = requestAnimationFrame(tick);
    });
};

// ---------------------------------------------------------------------------
// The two cards and the seam
// ---------------------------------------------------------------------------

const Poster = ({ name, posterPath, priority = false }: { name: string; posterPath: string | null; priority?: boolean }) => (
  <span className="mayor-poster block shrink-0 overflow-hidden rounded-2xl shadow-[0_18px_34px_-18px_#000,0_0_0_1px_rgba(255,255,255,.08)]">
    <PosterImage name={name} posterPath={posterPath} sizes="160px" tmdbSize="w342" ratio="fill" priority={priority} />
  </span>
);

const Card = ({
  side,
  name,
  posterPath,
  caption,
  value,
  tone,
  delta,
  note,
  compact,
  size,
  className,
}: {
  side: "top" | "bottom";
  name: string | null;
  posterPath?: string | null;
  caption: string;
  value: ReactNode;
  tone: BigNumberTone;
  delta?: { text: string; ok: boolean } | null;
  note?: ReactNode;
  compact: boolean;
  size: "xl" | "lg";
  className?: string;
}) => (
  <div
    className={cn(
      "mayor-card relative flex gap-3.5 overflow-hidden rounded-[1.625rem] border p-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,.05)]",
      side === "bottom" && "flex-row-reverse",
      compact && "items-center p-2.5",
      tone === "ok" ? "border-success/55" : tone === "no" ? "border-danger/55" : "border-white/[0.09]",
      className,
    )}
    style={{
      background:
        side === "top"
          ? "radial-gradient(130% 150% at 0 0, rgb(255 122 69 / .24), rgb(255 122 69 / 0) 62%), #151a20"
          : "radial-gradient(130% 150% at 100% 100%, rgb(143 180 255 / .2), rgb(143 180 255 / 0) 62%), #151a20",
    }}
    data-mayor-card={side}
  >
    {name != null ? <Poster name={name} posterPath={posterPath ?? null} priority /> : null}
    <div className={cn("flex min-w-0 flex-1", compact ? "flex-row items-center gap-2.5" : "flex-col", side === "bottom" && name == null && !compact && "items-end text-right")}>
      {/* The bottom card's name starts under the medallion on the seam. */}
      <div className={cn("flex min-w-0 flex-col gap-1", compact && "flex-1", side === "bottom" && !compact && "pt-7")}>
        {name != null ? (
          <span className={cn("font-serif font-semibold leading-[1.12] text-paper", compact ? "line-clamp-2 text-[17px]" : "line-clamp-3 text-xl")}>{name}</span>
        ) : null}
        {note}
      </div>
      {compact ? null : <div className="flex-1" />}
      <div className={cn("flex flex-col gap-1", side === "bottom" && name == null && !compact && "items-end")}>
        {compact ? null : <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">{caption}</span>}
        <BigNumber size={compact ? "md" : size} tone={tone}>
          {value}
        </BigNumber>
        {!compact ? (
          <span
            className={cn(
              "inline-flex h-[26px] w-max items-center rounded-full px-2.5 text-[13px] font-semibold tabular-nums",
              delta ? (delta.ok ? "bg-success-well text-success" : "bg-danger-well text-danger") : "invisible",
            )}
            aria-hidden={delta ? undefined : true}
          >
            {delta?.text ?? "·"}
          </span>
        ) : null}
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// The lens sheet (FIL-I56-4, board M-4-lentes)
// ---------------------------------------------------------------------------

const LensIcon = ({ id }: { id: MayorLensId }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
    {id === "imdb" ? (
      <path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16l-5 2.9 1.2-5.5L4 9.6l5.6-.6z" />
    ) : id === "year" ? (
      <>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </>
    ) : id === "runtime" ? (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ) : (
      <path d="M7 20V10M12 20V4M17 20v-7" />
    )}
  </svg>
);

const LensPill = ({ label, onOpen, open }: { label: string; onOpen: () => void; open: boolean }) => (
  <button
    type="button"
    onClick={onOpen}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label={`Dato: ${label}. Cambiar de dato`}
    className={cn(
      "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-star/45 bg-[#2b2412] px-3.5 text-sm font-semibold text-star",
      focusRing,
    )}
    data-mayor="pildora"
  >
    {label}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>
);

const LensSheet = ({
  open,
  onClose,
  current,
  records,
}: {
  open: boolean;
  onClose: () => void;
  current: MayorLensId;
  records: Partial<Record<MayorLensId, number>>;
}) => (
  <Sheet open={open} onClose={onClose} labelledBy="mayor-lentes-titulo" align="bottom">
    <div className="flex flex-col px-5 pb-4 pt-3" data-mayor="lentes">
      <SheetHandle className="mx-auto" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fog">Elige el dato</p>
      <h2 id="mayor-lentes-titulo" className="mb-3.5 mt-1 font-serif text-[1.45rem] font-semibold text-paper">
        ¿Con qué jugamos?
      </h2>
      <ul className="flex flex-col gap-2">
        {MAYOR_LENS_IDS.map((id) => {
          const best = records[id] ?? 0;
          const active = id === current;
          return (
            <li key={id}>
              <Link
                href={id === "imdb" ? MAYOR_PATH : `${MAYOR_PATH}?lente=${id}`}
                onClick={onClose}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex min-h-[4.25rem] items-center gap-3 rounded-[1.375rem] border px-3 py-2.5 text-left",
                  active ? "border-accent/50 bg-accent/10" : "border-line bg-surface",
                  focusRing,
                )}
                data-lente={id}
              >
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-[14px] border border-white/[0.14] bg-[#12161a]", active ? "text-star" : "text-accent")}>
                  <LensIcon id={id} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <b className="text-base font-semibold text-paper">{MAYOR_LENSES[id].label}</b>
                  <span className="text-sm leading-snug text-fog">{MAYOR_LENSES[id].line}</span>
                </span>
                {best > 0 ? (
                  <span className="flex shrink-0 flex-col items-end gap-px">
                    <span className="font-serif text-[22px] font-semibold leading-none text-star tabular-nums">{best}</span>
                    <span className="text-xs text-fog">récord</span>
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-accent/50 bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">Estrénalo</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3.5 text-center text-xs text-fog">Cada dato guarda su propio récord.</p>
    </div>
  </Sheet>
);

/** Muerte súbita (FIL-I53-2, board M-4-subita): the person's progress and where the rival fell. */
export const SuddenDeathBar = ({ rival, view }: { rival: MayorRival; view: MayorView }) => {
  const track = suddenDeathTrack({ rivalName: rival.name, rivalScore: rival.score, mine: view.score, total: view.total });
  return (
    <div className="flex flex-col gap-2" data-mayor="subita">
      <div className="relative mx-3 h-14" role="img" aria-label={track.label}>
        <span className="absolute inset-x-0 top-5 h-1 rounded-full bg-chrome" />
        <span className="absolute left-0 top-5 h-1 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${track.mePct}%` }} />
        {track.rivalPct != null ? (
          <>
            <span
              className="absolute top-0 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-canvas bg-affinity text-[11px] font-bold text-ink"
              style={{ left: `${track.rivalPct}%` }}
              data-mayor-marca="rival"
              data-par={track.rivalPair ?? undefined}
            >
              {rival.initial}
            </span>
            <span
              className="absolute top-9 -translate-x-1/2 whitespace-nowrap text-[11px] text-fog"
              style={{ left: `${Math.min(Math.max(track.rivalPct, 18), 82)}%` }}
            >
              aquí cayó {rival.name}
            </span>
          </>
        ) : null}
        <span
          className="absolute top-[0.9rem] z-10 flex size-4 -translate-x-1/2 items-center justify-center rounded-full bg-accent ring-2 ring-canvas"
          style={{ left: `${track.mePct}%` }}
          data-mayor-marca="tu"
        />
      </div>
      <p className="text-center text-xs text-fog">{track.line}</p>
    </div>
  );
};

export type MayorRival = { name: string; initial: string; score: number };

/** «sábado 14», short enough for the header at 375 px. */
const shortDay = (day: string) =>
  new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/**
 * Mayor o menor's play screen (boards Main, M-2-acierto, M-3-fin, M-5-diaria), for a free streak,
 * the daily or a reto. Two stacked cards (the reference above, the hidden one below) with the
 * streak on the seam; the keys carry the reference value. The server judges each answer and only
 * then sends the hidden value, which counts up from the reference. A daily or a reto that ends
 * hands over to the server-rendered result (router refresh).
 */
export const MayorGame = ({
  initialView,
  endExtra,
  lensRecords,
  answerAction = answerMayorStep,
  rival,
  title = "Mayor o menor",
  backHref,
  backLabel,
}: {
  initialView: MayorView;
  /** Free streak only: shown in the end screen under «Retar» (today's daily, when not played). */
  endExtra?: ReactNode;
  /** Free records per lens: the header pill opens the lens sheet (free streak only). */
  lensRecords?: Partial<Record<MayorLensId, number>>;
  /** Where answers go: the free/daily action by default; a reto or a link passes its own (FIL-I53). */
  answerAction?: (partidaId: string, index: number, guess: string) => Promise<MayorAnswerOutcome>;
  /** Muerte súbita: the sender's streak, drawn on a bar over the game. */
  rival?: MayorRival | null;
  title?: string;
  backHref?: string;
  backLabel?: string;
}) => {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const runCount = useCount();
  const [view, setView] = useState(initialView);
  // The step on screen: kept after the last answer so the revealed value stays visible.
  const [shown, setShown] = useState<MayorStep | null>(initialView.step);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<MayorGuess | null>(null);
  const [counted, setCounted] = useState<string | null>(null);
  // The bottom card just moved up: the new pair enters with the relevo.
  const [relevo, setRelevo] = useState(0);
  const [lensOpen, setLensOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const lens = MAYOR_LENSES[view.lens];
  const single = lens.shape === "single";
  const ended = view.finished;
  const libre = view.mode === "libre";
  const showResult = phase === "revealed" || (ended && reveal != null);
  // Until the next view lands, the answer just revealed already counts.
  const pendingHit = phase === "revealed" && !ended && reveal?.correct ? 1 : 0;
  const pendingAnswers = phase === "revealed" && !ended && reveal ? [...view.answers, reveal.correct] : view.answers;
  const hits = view.answers.filter(Boolean).length + pendingHit;
  const streak = libre || view.mode === "reto" ? view.score + pendingHit : hits;
  const medallionState: MedallionState = showResult && reveal ? (reveal.correct ? "up" : "down") : "normal";

  const answer = async (guess: MayorGuess) => {
    if (!shown || phase !== "idle") return;
    setPicked(guess);
    setPhase("waiting");
    let outcome: MayorAnswerOutcome;
    try {
      outcome = await answerAction(view.partidaId, shown.index, guess);
    } catch {
      // Nothing changed on screen; the partida is saved on the server and picks up from here.
      setPicked(null);
      setPhase("idle");
      showActionError({ title: "Sin conexión", description: "Tu partida sigue guardada. Vuelve a intentarlo." });
      return;
    }
    if (!outcome.ok) {
      setPicked(null);
      setPhase("idle");
      if (outcome.view) {
        setView(outcome.view);
        setShown(outcome.view.step ?? shown);
      } else {
        showActionError({ title: "No se pudo contestar", description: outcome.error });
      }
      return;
    }
    const next = outcome.view;
    setReveal({ value: outcome.revealed, correct: outcome.correct });
    const from = unitsOf(view.lens, shown.left.value);
    const to = unitsOf(view.lens, outcome.revealed);
    setPhase("counting");
    if (from != null && to != null) {
      await runCount(from, to, reduced, (units) => setCounted(formatUnits(view.lens, units)));
    }
    setCounted(null);
    setPhase("revealed");
    if (next.finished) {
      timer.current = window.setTimeout(() => {
        // The last pair stays on screen; a daily or a reto then shows its result.
        setView(next);
        setPhase("idle");
        if (next.mode !== "libre") timer.current = window.setTimeout(() => router.refresh(), 400);
      }, HOLD_MS);
      return;
    }
    timer.current = window.setTimeout(() => {
      setView(next);
      setShown(next.step);
      setReveal(null);
      setPicked(null);
      setPhase("idle");
      setRelevo((count) => count + 1);
    }, HOLD_MS);
  };

  const again = async () => {
    setPhase("waiting");
    try {
      const outcome = await startMayorFree(view.lens);
      if (!outcome.ok) {
        showActionError({ title: "No se pudo empezar", description: outcome.error });
        return;
      }
      setView(outcome.view);
      setShown(outcome.view.step);
      setReveal(null);
      setPicked(null);
      setRelevo(0);
    } catch {
      showActionError({ title: "Sin conexión", description: "Revisa tu conexión y vuelve a intentarlo." });
    } finally {
      setPhase("idle");
    }
  };

  const eyebrow =
    view.mode === "reto"
      ? "Muerte súbita"
      : view.mode === "diaria"
        ? `La diaria n.º ${dailyNumber(view.day ?? "")} · ${shortDay(view.day ?? "")}`
        : "Racha libre";
  const chip = lensRecords ? (
    <LensPill label={lens.short} onOpen={() => setLensOpen(true)} open={lensOpen} />
  ) : (
    <LensChip>{lens.short}</LensChip>
  );

  const compact = ended && libre;
  const size = view.lens === "imdb" ? "xl" : "lg";
  const bottomTone: BigNumberTone = showResult && reveal ? (reveal.correct ? "ok" : "no") : phase === "counting" ? "counting" : "hidden";
  const bottomValue = phase === "counting" && counted ? counted : showResult && reveal ? reveal.value : "?";
  const from = shown ? unitsOf(view.lens, shown.left.value) : null;
  const to = reveal ? unitsOf(view.lens, reveal.value) : null;
  const delta = showResult && reveal && from != null && to != null ? { text: deltaText(view.lens, from, to), ok: reveal.correct } : null;
  const labels = shown ? keyLabels(view.lens, shown.left.value) : null;
  const keyState = (which: MayorGuess): KeyState => {
    if (phase === "idle" && !ended) return "idle";
    if (picked !== which) return "off";
    return showResult && reveal ? (reveal.correct ? "ok" : "no") : "idle";
  };
  const guessWord = picked && labels ? (picked === "mayor" ? labels.higher : labels.lower).split(" ")[0]!.toLowerCase() : null;

  return (
    <div className="flex flex-1 flex-col" data-mayor={ended ? "fin" : "jugando"}>
      <MayorTopBar eyebrow={eyebrow} title={title} chip={chip} backHref={backHref} backLabel={backLabel} />
      <div className="mt-2">
        {rival ? (
          <SuddenDeathBar rival={rival} view={view} />
        ) : view.mode === "diaria" ? (
          <SquaresSlot answers={pendingAnswers} total={view.total} label={`Par ${Math.min(view.answers.length + 1, view.total)} de ${view.total}: ${hits} aciertos`} />
        ) : (
          <RecordSlot best={view.best} current={streak} ended={ended} />
        )}
      </div>
      {shown ? (
        <div className={cn("mayor-stack relative mt-2 flex flex-col gap-3", compact && "mayor-stack-compact")} data-mayor="board">
          <Card
            key={`a-${shown.index}-${view.partidaId}`}
            side="top"
            name={shown.left.name}
            posterPath={shown.left.posterPath}
            caption={lens.leftCaption}
            value={<ValueText lens={view.lens} text={shown.left.value} />}
            tone="shown"
            compact={compact}
            size={size}
            className={relevo > 0 && !single ? "mayor-relevo" : relevo > 0 ? "juego-rise" : undefined}
          />
          <Card
            key={`b-${shown.index}-${view.partidaId}`}
            side="bottom"
            name={single ? null : shown.right.name}
            posterPath={shown.right.posterPath}
            caption={lens.rightCaption}
            value={<ValueText lens={view.lens} text={bottomValue} />}
            tone={bottomTone}
            delta={delta}
            note={compact && guessWord ? <span className="text-sm text-danger">Dijiste {guessWord}</span> : null}
            compact={compact}
            size={size}
            className={cn(relevo > 0 && "juego-rise", showResult && reveal && !reveal.correct && !compact && "juego-shake")}
          />
          <StreakMedallion
            value={streak}
            label={view.mode === "diaria" ? "aciertos" : "racha"}
            state={medallionState}
            compact={compact}
            className="mayor-medallion"
          />
        </div>
      ) : null}

      {compact ? (
        <div className="juego-rise mt-7 flex flex-col gap-3" data-mayor="cierre">
          <div className="mb-1 flex flex-col items-center gap-1.5 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fog">
              {view.answers.at(-1) === false ? "Hasta aquí llegaste" : "Te las llevaste todas"}
            </span>
            <span className="font-serif text-[2.6rem] font-semibold leading-none text-paper tabular-nums">Racha de {view.score}</span>
            <p className="text-sm text-fog">
              {view.score >= view.best && view.score > 0 ? `Es tu mejor racha con ${lens.short}.` : `Tu récord con ${lens.short} sigue en ${view.best}.`}
            </p>
            <ResultSquares
              answers={view.answers.slice(-20)}
              size={view.answers.length > 13 ? "sm" : "md"}
              className="mt-2 justify-center"
              label={view.answers.at(-1) === false ? `${view.score} aciertos y un fallo` : `${view.score} aciertos`}
            />
          </div>
          <button
            type="button"
            onClick={again}
            disabled={phase !== "idle"}
            className={buttonClass({ variant: "primary", size: "lg", className: "mt-1.5 w-full" })}
            data-mayor="otra-vez"
          >
            Otra vez
          </button>
          {view.score > 0 ? (
            <Link
              href={`${RETAR_PATH}?juego=mayor&partida=${view.partidaId}`}
              className={buttonClass({ variant: "secondary", size: "lg", className: "w-full" })}
              data-mayor="retar"
            >
              Retar a alguien con esta racha
            </Link>
          ) : null}
          {endExtra}
        </div>
      ) : ended ? (
        <p className="mt-6 pb-2 text-center text-sm text-fog" aria-live="polite">
          Contando tus aciertos…
        </p>
      ) : shown && labels ? (
        <div className="mt-3.5 flex flex-col gap-3 pb-1">
          <AnswerKeys
            lower={labels.lower}
            higher={labels.higher}
            lowerState={keyState("menor")}
            higherState={keyState("mayor")}
            disabled={phase !== "idle"}
            onPick={answer}
          />
          <p className="text-center text-xs text-fog" aria-live="polite">
            {view.mode === "diaria" ? "Un intento al día. Los mismos diez pares para todos." : lens.question(shown.left.name, shown.right.name)}
          </p>
        </div>
      ) : null}

      {lensRecords ? (
        <LensSheet
          open={lensOpen}
          onClose={() => setLensOpen(false)}
          current={view.lens}
          records={{ ...lensRecords, [view.lens]: Math.max(lensRecords[view.lens] ?? 0, view.best) }}
        />
      ) : null}
    </div>
  );
};
