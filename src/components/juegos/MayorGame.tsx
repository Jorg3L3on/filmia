"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { answerMayorStep, startMayorFree } from "@/app/actions/juegos";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { dailyNumber, MAYOR_DAILY_PATH, MAYOR_LENS_IDS, MAYOR_LENSES, MAYOR_PATH, type MayorGuess, type MayorLensId } from "@/lib/juegos/mayor/core";
import type { MayorAnswerOutcome, MayorStep, MayorView } from "@/lib/juegos/mayor/store";
import { RETAR_PATH, suddenDeathTrack } from "@/lib/juegos/retos/core";
import { usePrefersReducedMotion } from "@/lib/motion";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

/** How long the revealed value stays before the right film moves left. */
const REVEAL_MS = 950;

type Reveal = { value: string; correct: boolean };

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

const Value = ({ value, tone }: { value: string; tone: "shown" | "hidden" | "ok" | "no" }) => (
  <span
    className={cn(
      "font-serif text-[1.9rem] font-semibold leading-none tabular-nums",
      tone === "shown" && "text-star",
      tone === "hidden" && "text-fog",
      tone === "ok" && "text-success",
      tone === "no" && "text-danger",
    )}
    data-mayor-value={tone}
  >
    {value}
  </span>
);

const Poster = ({ name, posterPath, priority = false }: { name: string; posterPath: string | null; priority?: boolean }) => (
  <span className="block aspect-[2/3] w-full overflow-hidden rounded-2xl shadow-[0_26px_50px_-22px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,.08)]">
    <PosterImage name={name} posterPath={posterPath} sizes="170px" tmdbSize="w342" ratio="fill" priority={priority} />
  </span>
);

const FilmName = ({ children }: { children: string }) => (
  <span className="line-clamp-2 min-h-[2.6em] text-center text-[15px] font-semibold leading-tight text-paper">{children}</span>
);

/** The two films (or, in the critics lens, one film and its two scores). */
const Board = ({ view, step, reveal }: { view: MayorView; step: MayorStep; reveal: Reveal | null }) => {
  const lens = MAYOR_LENSES[view.lens];
  const hidden: Reveal | null = reveal;
  const rightTone = hidden ? (hidden.correct ? "ok" : "no") : "hidden";
  if (lens.shape === "single") {
    return (
      <div className="mx-auto flex w-full max-w-[22rem] flex-col items-center gap-4" data-mayor="board">
        <div className="w-[11.5rem]">
          <Poster name={step.left.name} posterPath={step.left.posterPath} priority />
        </div>
        <FilmName>{step.left.name}</FilmName>
        <div className="grid w-full grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-3 py-3">
            <Value value={step.left.value} tone="shown" />
            <span className="text-center text-xs text-fog">{lens.leftCaption}</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-3 py-3">
            <Value value={hidden?.value ?? "?"} tone={rightTone} />
            <span className="text-center text-xs text-fog">{lens.rightCaption}</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 items-start gap-3.5" data-mayor="board">
      <div className="flex min-w-0 flex-col items-center gap-2">
        <Poster name={step.left.name} posterPath={step.left.posterPath} priority />
        <FilmName>{step.left.name}</FilmName>
        <Value value={step.left.value} tone="shown" />
        <span className="text-xs text-fog">{lens.leftCaption}</span>
      </div>
      <div className="flex min-w-0 flex-col items-center gap-2">
        <Poster name={step.right.name} posterPath={step.right.posterPath} priority />
        <FilmName>{step.right.name}</FilmName>
        <Value value={hidden?.value ?? "?"} tone={rightTone} />
        <span className="text-xs text-fog">{lens.rightCaption}</span>
      </div>
    </div>
  );
};

const ArrowIcon = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
    <path d={up ? "M7 15l5-6 5 6" : "M7 9l5 6 5-6"} />
  </svg>
);

/** Small squares, one per answer: green right, red wrong. */
export const Squares = ({ answers, total, small = false }: { answers: readonly boolean[]; total?: number; small?: boolean }) => (
  <span className="flex flex-wrap gap-1.5" aria-label={`${answers.filter(Boolean).length} de ${total ?? answers.length}`}>
    {Array.from({ length: total ?? answers.length }, (_, index) => (
      <span
        key={index}
        className={cn(
          small ? "size-3.5 rounded-[4px]" : "size-[1.375rem] rounded-md",
          answers[index] === true ? "bg-success" : answers[index] === false ? "bg-danger" : "bg-chrome",
        )}
      />
    ))}
  </span>
);

/**
 * «¿Con qué dato?» (FIL-I52-5, board M-2-lentes): four lenses, each with its own free record. Each
 * lens keeps its own unfinished partida, so switching and coming back picks it up again.
 */
const LensBar = ({ current, records }: { current: MayorLensId; records: Partial<Record<MayorLensId, number>> }) => (
  <nav aria-label="¿Con qué dato?" className="grid grid-cols-4 gap-1.5" data-mayor="lentes">
    {MAYOR_LENS_IDS.map((id) => {
      const best = records[id] ?? 0;
      const active = id === current;
      return (
        <Link
          key={id}
          href={id === "imdb" ? MAYOR_PATH : `${MAYOR_PATH}?lente=${id}`}
          aria-current={active ? "page" : undefined}
          aria-label={`${MAYOR_LENSES[id].label}. ${MAYOR_LENSES[id].line}${best ? ` Tu récord: ${best}.` : ""}`}
          className={cn(
            "flex min-h-12 flex-col justify-center rounded-xl border px-2 py-1.5 text-center",
            active ? "border-accent/60 bg-accent/10" : "border-line bg-surface",
            focusRing,
          )}
        >
          <b className={cn("truncate text-[13px] font-semibold", active ? "text-paper" : "text-mist")}>{MAYOR_LENSES[id].short}</b>
          {best ? (
            <span className="truncate text-[11px] font-semibold text-star">Récord {best}</span>
          ) : (
            <span className="truncate text-[11px] text-fog">Sin récord</span>
          )}
        </Link>
      );
    })}
  </nav>
);

const eyebrowOf = (view: MayorView, streak: number) =>
  view.mode === "reto"
    ? `Muerte súbita · racha de ${streak}`
    : view.mode === "diaria"
    ? `La diaria · n.º ${dailyNumber(view.day ?? "")} · ${Math.min(view.answers.length + 1, view.total)} de ${view.total}`
    : `Racha de ${streak} · tu mejor: ${view.best}`;

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

/**
 * Mayor o menor's play screen (board Main), for a free streak or the daily. Buttons do everything;
 * the server judges each answer and only then sends the hidden value. A daily that ends hands
 * over to the server-rendered result (router refresh).
 */
export const MayorGame = ({
  initialView,
  headerExtra,
  lensRecords,
  answerAction = answerMayorStep,
  rival,
  title = "Mayor o menor",
  backHref,
  backLabel,
}: {
  initialView: MayorView;
  headerExtra?: ReactNode;
  /** Free records per lens: shows the lens picker (free streak only). */
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
  const [view, setView] = useState(initialView);
  // The step on screen: kept after the last answer so the revealed value stays visible.
  const [shown, setShown] = useState<MayorStep | null>(initialView.step);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const lens = MAYOR_LENSES[view.lens];
  const streak = view.mode === "libre" ? view.score : view.answers.filter(Boolean).length;

  const answer = async (guess: MayorGuess) => {
    if (!shown || pending || reveal) return;
    setPending(true);
    try {
      const outcome = await answerAction(view.partidaId, shown.index, guess);
      if (!outcome.ok) {
        if (outcome.view) {
          setView(outcome.view);
          setShown(outcome.view.step ?? shown);
        } else {
          showActionError({ title: "No se pudo contestar", description: outcome.error });
        }
        return;
      }
      setReveal({ value: outcome.revealed, correct: outcome.correct });
      if (outcome.view.finished) {
        // The last pair and its value stay on screen; the daily then shows its result.
        setView(outcome.view);
        // The daily and a reto hand over to their server-rendered result.
        if (outcome.view.mode !== "libre") timer.current = window.setTimeout(() => router.refresh(), REVEAL_MS + 400);
        return;
      }
      timer.current = window.setTimeout(
        () => {
          setView(outcome.view);
          setShown(outcome.view.step);
          setReveal(null);
        },
        reduced ? REVEAL_MS + 300 : REVEAL_MS,
      );
    } catch {
      // Nothing changed on screen; the partida is saved on the server and picks up from here.
      showActionError({ title: "Sin conexión", description: "Tu partida sigue guardada. Vuelve a intentarlo." });
    } finally {
      setPending(false);
    }
  };

  const again = async () => {
    setPending(true);
    try {
      const outcome = await startMayorFree(view.lens);
      if (!outcome.ok) {
        showActionError({ title: "No se pudo empezar", description: outcome.error });
        return;
      }
      setView(outcome.view);
      setShown(outcome.view.step);
      setReveal(null);
    } catch {
      showActionError({ title: "Sin conexión", description: "Revisa tu conexión y vuelve a intentarlo." });
    } finally {
      setPending(false);
    }
  };

  const ended = view.finished;

  return (
    <div className="flex flex-1 flex-col gap-4" data-mayor={ended ? "fin" : "jugando"}>
      <MayorTopBar eyebrow={eyebrowOf(view, streak)} title={title} chip={<LensChip>{lens.short}</LensChip>} backHref={backHref} backLabel={backLabel} />
      {headerExtra}
      {rival ? <SuddenDeathBar rival={rival} view={view} /> : null}
      {lensRecords ? <LensBar current={view.lens} records={{ ...lensRecords, [view.lens]: Math.max(lensRecords[view.lens] ?? 0, view.best) }} /> : null}
      {shown ? (
        <>
          <p className="min-h-[2.6rem] text-[15px] leading-snug text-fog" aria-live="polite">
            {lens.question(shown.left.name, shown.right.name)}
          </p>
          <Board view={view} step={shown} reveal={reveal} />
        </>
      ) : null}
      <div className="flex-1" />
      {ended && view.mode === "libre" ? (
        <div className="rounded-[1.4rem] border border-star/40 bg-surface p-4" data-mayor="cierre">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-serif text-[1.35rem] font-semibold text-paper">
              {view.answers.at(-1) === false ? "Hasta aquí llegaste" : "Te las llevaste todas"}
            </h2>
            <span className="font-serif text-[1.9rem] font-semibold leading-none text-star tabular-nums">{view.score}</span>
          </div>
          <p className="mt-1.5 text-sm text-fog">
            {view.score >= view.best && view.score > 0
              ? `Racha de ${view.score}: tu mejor con ${lens.short}.`
              : `Racha de ${view.score}. Tu mejor con ${lens.short}: ${view.best}.`}
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={again} disabled={pending} className={buttonClass({ variant: "primary", size: "lg", className: "flex-1" })}>
              Otra vez
            </button>
            <Link href={MAYOR_DAILY_PATH} className={buttonClass({ variant: "secondary", size: "lg", className: "flex-1" })}>
              La diaria
            </Link>
          </div>
          {view.score > 0 ? (
            <Link
              href={`${RETAR_PATH}?juego=mayor&partida=${view.partidaId}`}
              className={cn("mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-accent", focusRing)}
              data-mayor="retar"
            >
              Retar a alguien con esta racha
            </Link>
          ) : null}
        </div>
      ) : ended ? (
        <p className="pb-2 text-center text-sm text-fog" aria-live="polite">
          Contando tus aciertos…
        </p>
      ) : shown ? (
        <div className="flex gap-3 pb-1">
          <button
            type="button"
            onClick={() => answer("menor")}
            disabled={pending || reveal != null}
            className={buttonClass({ variant: "secondary", size: "lg", className: "min-h-[3.6rem] flex-1 gap-2 text-base" })}
          >
            <ArrowIcon up={false} />
            {lens.lower}
          </button>
          <button
            type="button"
            onClick={() => answer("mayor")}
            disabled={pending || reveal != null}
            className={buttonClass({ variant: "primary", size: "lg", className: "min-h-[3.6rem] flex-1 gap-2 text-base" })}
          >
            <ArrowIcon up />
            {lens.higher}
          </button>
        </div>
      ) : null}
    </div>
  );
};
