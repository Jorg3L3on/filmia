"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { answerTandaCard, loadTandaCorte, nextTanda, undoTandaAnswer } from "@/app/actions/juegos";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { corteHeadline, isSeenAnswer, TANDA_ANSWER_LABEL, type TandaAnswer } from "@/lib/juegos/tanda/core";
import type { TandaCard, TandaCorte, TandaState } from "@/lib/juegos/tanda/store";
import { usePrefersReducedMotion } from "@/lib/motion";
import { showActionError, TOAST_COPY, toastPoster } from "@/lib/toast-alerts";
import { focusRing } from "@/lib/ui";

type Direction = "right" | "left" | "down" | "up";
type StampAnswer = Exclude<TandaAnswer, "want">;

/** Right me gustó · left no la vi · down no tanto · up me encantó (board A-2). */
const ANSWER_OF: Record<Direction, StampAnswer> = { right: "liked", left: "no", down: "meh", up: "loved" };
const DIRECTION_OF: Record<StampAnswer, Direction> = { liked: "right", no: "left", meh: "down", loved: "up" };

/** A drag confirms past this share of the card's width, or on a flick. */
const COMMIT_SHARE = 0.25;
const FLICK_PX_PER_MS = 0.55;
/** The stamp starts showing at a quarter of the width and is full at a third. */
const STAMP_FROM = 0.25;
const STAMP_FULL = 1 / 3;
const MAX_TILT_DEG = 10;
const FLY_MS = 330;
const RETURN_EASE = "cubic-bezier(.32,.72,0,1)";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const FRAME_CLASS: Record<TandaAnswer, string> = {
  liked: "bg-success",
  loved: "bg-star",
  meh: "bg-[#ff8a96]",
  no: "bg-white/15",
  want: "bg-white/15",
};

const STAMP_CLASS: Record<StampAnswer, string> = {
  liked: "border-success text-success -rotate-12 left-4 top-7",
  no: "border-paper/80 text-paper rotate-12 right-4 top-7",
  meh: "border-[#ff8a96] text-[#ff8a96] left-1/2 top-6 -translate-x-1/2 -rotate-[4deg]",
  loved: "border-star text-star left-1/2 bottom-7 -translate-x-1/2 -rotate-[4deg]",
};

type Drag = { x: number; y: number; t: number; id: number };
type Motion = { dx: number; dy: number; animate: "none" | "return" | "fly" | "fade"; leaving: StampAnswer | null };

const REST: Motion = { dx: 0, dy: 0, animate: "none", leaving: null };

const flyTarget = (direction: Direction, dx: number, dy: number) =>
  direction === "right"
    ? { dx: 560, dy }
    : direction === "left"
      ? { dx: -560, dy }
      : direction === "down"
        ? { dx, dy: 820 }
        : { dx, dy: -820 };

const directionOf = (dx: number, dy: number): Direction =>
  Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "down" : "up";

const AnswerIcon = ({ answer }: { answer: StampAnswer }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill={answer === "loved" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={answer === "liked" ? 2.6 : 2.2} strokeLinecap="round" strokeLinejoin="round">
    {answer === "no" ? <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /> : null}
    {answer === "meh" ? <path d="M5 13.5c2.2-3.4 4.6-3.4 7 0s4.8 3.4 7 0" /> : null}
    {answer === "loved" ? <path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.9a4.3 4.3 0 0 1 7.5 2.5c0 5.5-7.5 10.1-7.5 10.1z" /> : null}
    {answer === "liked" ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : null}
  </svg>
);

const ARROW: Record<StampAnswer, string> = { no: "←", meh: "↓", loved: "↑", liked: "→" };
const BUTTON_ORDER: StampAnswer[] = ["no", "meh", "loved", "liked"];
const BUTTON_TONE: Record<StampAnswer, string> = {
  no: "text-paper",
  meh: "text-[#ff8a96]",
  loved: "text-star",
  liked: "text-success",
};

const Strip = ({ cards, current }: { cards: TandaCard[]; current: number }) => {
  const seen = cards.filter((card) => card.answer && isSeenAnswer(card.answer)).length;
  return (
    <div
      role="img"
      aria-label={`Carta ${Math.min(current + 1, cards.length)} de ${cards.length}, ${seen} ${seen === 1 ? "vista" : "vistas"}`}
      className="flex flex-1 gap-1"
    >
      {cards.map((card, index) => (
        <span
          key={card.catalogId}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            card.answer ? FRAME_CLASS[card.answer] : index === current ? "bg-accent" : "bg-line",
          )}
        />
      ))}
    </div>
  );
};

const TopBar = ({ eyebrow, title, onUndo, canUndo }: { eyebrow: string; title: string; onUndo?: () => void; canUndo?: boolean }) => (
  <div className="flex items-center gap-3">
    <Link
      href={JUEGOS_PATH}
      aria-label="Volver a Extras"
      className={cn("relative flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-paper", focusRing)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h1 className="truncate font-serif text-[1.45rem] font-semibold leading-tight text-paper">{title}</h1>
    </div>
    {onUndo ? (
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Deshacer la última respuesta"
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-paper transition-opacity disabled:opacity-35",
          focusRing,
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
          <path d="M8 7L4 11l4 4M4 11h10a5 5 0 0 1 0 10h-3" />
        </svg>
      </button>
    ) : null}
  </div>
);

/** «La tanda · 2010–2019», «La tanda 2 · 1985–1999» for each «Otra tanda». */
const eyebrowOf = (round: number, epoch: string) => `La tanda${round > 1 ? ` ${round}` : ""} · ${epoch}`;

type CorteProps = {
  cards: TandaCard[];
  round: number;
  epoch: string;
  corte: TandaCorte | null;
  onMore: () => void;
  dealing: boolean;
  exhausted: boolean;
};

const Corte = ({ cards, round, epoch, corte, onMore, dealing, exhausted }: CorteProps) => {
  const seenCards = cards.filter((card) => card.answer && isSeenAnswer(card.answer));
  const counts = { liked: 0, loved: 0, meh: 0 };
  for (const card of seenCards) counts[card.answer as keyof typeof counts] += 1;
  const legend = [
    counts.liked ? `${counts.liked} me gustó` : null,
    counts.loved ? `${counts.loved} me encantó` : null,
    counts.meh ? `${counts.meh} no tanto` : null,
  ].filter(Boolean);
  const people = corte?.newPeople ?? [];
  return (
    <div className="flex flex-col gap-5" data-tanda="corte">
      <TopBar eyebrow={`Corte · ${eyebrowOf(round, epoch)}`} title="Las que todos vimos" />
      <div className="text-center">
        <p className="font-serif text-[4.2rem] font-semibold leading-none text-paper">
          {seenCards.length} <span className="text-[2.2rem] font-medium italic text-fog">de</span> {cards.length}
        </p>
        <p className="mt-1 text-fog">{seenCards.length === 0 ? "Ninguna esta vez" : "las viste"}</p>
        <span className="sr-only">{corteHeadline(seenCards.length, cards.length)}</span>
      </div>
      <div className="flex justify-center">
        <div className="flex w-full max-w-[18rem]">
          <Strip cards={cards} current={cards.length} />
        </div>
      </div>
      {legend.length > 0 ? <p className="-mt-2 text-center text-xs text-fog">{legend.join(" · ")}</p> : null}
      {seenCards.length > 0 ? (
        <ul className="flex justify-center pl-3.5" aria-label="Las que viste">
          {seenCards.slice(0, 6).map((card, index) => (
            <li
              key={card.catalogId}
              className="-ml-3.5 h-24 w-16 overflow-hidden rounded-lg shadow-[0_10px_22px_-10px_rgba(0,0,0,.9),0_0_0_2px_var(--canvas)]"
              style={{ transform: `rotate(${index % 2 === 0 ? -5 : 4}deg)` }}
            >
              <PosterImage name={card.name} posterPath={card.posterPath} sizes="72px" tmdbSize="w185" ratio="fill" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-fog">El lunes llega otra tanda, de otra época.</p>
      )}
      <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby="tanda-cambio">
        <h2 id="tanda-cambio" className="text-base font-semibold text-paper">
          Lo que cambió
        </h2>
        {corte ? (
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            <li>
              <b className="text-paper">{corte.library} en tu filmoteca.</b>{" "}
              <span className="text-fog">{corte.added > 0 ? `+${corte.added} de esta tanda, sin fecha en tu diario.` : "Esta vez no sumaste."}</span>
            </li>
            {corte.seen > 0 ? (
              <li>
                <b className="text-paper">Hoy barajó de nuevo.</b> <span className="text-fog">Tu mazo ya usa estas respuestas.</span>
              </li>
            ) : null}
            <li>
              <b className="text-paper">Tu universo.</b>{" "}
              <span className="text-fog">
                {people.length > 0
                  ? `${people.length === 1 ? "Apareció" : "Aparecieron"} ${people.length === 1 ? people[0] : `${people.slice(0, -1).join(", ")} y ${people.at(-1)}`}.`
                  : "Sin gente nueva esta vez."}
              </span>
            </li>
          </ul>
        ) : (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-white/[0.04]" aria-hidden="true" />
        )}
      </section>
      {exhausted ? (
        <p className="text-center text-sm text-fog" role="status">
          Por ahora no hay más cartas para ti. El lunes llega otra tanda.
        </p>
      ) : null}
      <div className="flex gap-3 pt-1">
        {exhausted ? null : (
          <button
            type="button"
            onClick={onMore}
            disabled={dealing}
            data-tanda-more
            className={cn(
              "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-accent font-semibold text-ink transition-opacity hover:bg-accent-hover disabled:opacity-60",
              focusRing,
            )}
          >
            {dealing ? "Repartiendo…" : "Otra tanda"}
          </button>
        )}
        <Link
          href="/"
          className={cn(
            "inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-button)] font-semibold",
            exhausted ? "bg-accent text-ink hover:bg-accent-hover" : "border border-line bg-chrome text-paper",
            focusRing,
          )}
        >
          Listo
        </Link>
      </div>
    </div>
  );
};

/**
 * La tanda (FIL-I50-4, boards Main, A-1…A-4): one big card at a time, dragged with a stamp or
 * answered with four buttons that go the same way; Deshacer; the strip; the Corte at the end.
 * Only `transform` and `opacity` move. With reduced motion the card fades instead of flying.
 */
export const TandaGame = ({ initialState, initialCorte }: { initialState: TandaState; initialCorte: TandaCorte | null }) => {
  const initialCards = initialState.cards;
  const [cards, setCards] = useState(initialCards);
  const [round, setRound] = useState(initialState.round);
  const [epoch, setEpoch] = useState(initialState.epoch);
  const [dealing, setDealing] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [motion, setMotion] = useState<Motion>(REST);
  const [corte, setCorte] = useState<TandaCorte | null>(initialCorte);
  const [busyUndo, setBusyUndo] = useState(false);
  /** The card's width, measured when a drag starts: thresholds and stamps scale with it. */
  const [cardWidth, setCardWidth] = useState(280);
  /** Answers in the order they were given (the ones already there first), for Deshacer. */
  const [order, setOrder] = useState<string[]>(() =>
    initialCards.filter((card) => card.answer).map((card) => card.catalogId),
  );
  const reducedMotion = usePrefersReducedMotion();
  const drag = useRef<Drag | null>(null);
  const timers = useRef<number[]>([]);

  const current = cards.findIndex((card) => !card.answer);
  const card = current === -1 ? null : cards[current]!;
  const next = current === -1 ? null : (cards.slice(current + 1).find((item) => !item.answer) ?? null);
  const finished = cards.length > 0 && current === -1;

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // The Corte reads «lo que cambió» once the last card is in.
  useEffect(() => {
    if (!finished || corte) {
      return;
    }
    let cancelled = false;
    void loadTandaCorte()
      .then((value) => {
        if (!cancelled) setCorte(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [finished, corte]);

  const setAnswer = useCallback((catalogId: string, answer: TandaAnswer | null) => {
    setCards((list) => list.map((item) => (item.catalogId === catalogId ? { ...item, answer } : item)));
  }, []);

  const commit = useCallback(
    (target: TandaCard, answer: TandaAnswer, from: { dx: number; dy: number }) => {
      const stamp: StampAnswer = answer === "want" ? "no" : answer;
      const direction = DIRECTION_OF[stamp];
      // Two things race: the card's exit and the save. A failed save brings the card back,
      // whichever finishes first.
      let failed = false;
      let landed = false;
      const comeBack = (description: string) => {
        failed = true;
        if (landed) {
          setOrder((list) => list.filter((id) => id !== target.catalogId));
          setAnswer(target.catalogId, null);
        }
        showActionError({ title: TOAST_COPY.couldNotSave, description, poster: toastPoster(target.posterPath) });
      };
      if (reducedMotion) {
        setMotion({ dx: 0, dy: 0, animate: "fade", leaving: stamp });
      } else {
        setMotion({ ...flyTarget(direction, from.dx, from.dy), animate: "fly", leaving: stamp });
      }
      timers.current.push(
        window.setTimeout(() => {
          landed = true;
          if (failed) {
            setMotion({ dx: 0, dy: 0, animate: reducedMotion ? "none" : "return", leaving: null });
            return;
          }
          setAnswer(target.catalogId, answer);
          setCorte(null);
          setOrder((list) => [...list, target.catalogId]);
          setMotion(REST);
        }, FLY_MS),
      );
      void answerTandaCard(target.catalogId, answer)
        .then((outcome) => {
          if (!outcome.ok) comeBack(outcome.error);
        })
        .catch(() => comeBack("Revisa tu conexión."));
    },
    [reducedMotion, setAnswer],
  );

  const answerCurrent = (answer: TandaAnswer) => {
    if (!card || motion.leaving) return;
    commit(card, answer, { dx: motion.dx, dy: motion.dy });
  };

  const undo = () => {
    const lastId = order.at(-1);
    if (!lastId || busyUndo || motion.leaving) return;
    const previous = cards.find((item) => item.catalogId === lastId);
    setBusyUndo(true);
    setOrder((list) => list.slice(0, -1));
    setAnswer(lastId, null);
    setCorte(null);
    void undoTandaAnswer()
      .then((outcome) => {
        if (outcome.ok) return;
        setOrder((list) => [...list, lastId]);
        setAnswer(lastId, previous?.answer ?? null);
        showActionError({ title: "No se pudo deshacer", description: outcome.error });
      })
      .catch(() => {
        setOrder((list) => [...list, lastId]);
        setAnswer(lastId, previous?.answer ?? null);
        showActionError({ title: "No se pudo deshacer", description: "Revisa tu conexión." });
      })
      .finally(() => setBusyUndo(false));
  };

  /** «Otra tanda»: ten more, the same screen from the first card (FIL-I50-7). */
  const more = () => {
    if (dealing) return;
    setDealing(true);
    void nextTanda()
      .then((outcome) => {
        if (!outcome.ok) {
          showActionError({ title: "No se pudo repartir", description: outcome.error });
          return;
        }
        if (outcome.exhausted) {
          setExhausted(true);
          return;
        }
        setCards(outcome.state.cards);
        setRound(outcome.state.round);
        setEpoch(outcome.state.epoch);
        setOrder([]);
        setCorte(null);
        setMotion(REST);
        window.scrollTo({ top: 0 });
      })
      .catch(() => showActionError({ title: "No se pudo repartir", description: "Revisa tu conexión." }))
      .finally(() => setDealing(false));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!card || motion.leaving || event.button !== 0) return;
    // iPhone's «back» lives on the screen's edge: a press there is the system's, not the card's.
    if (event.clientX < 24 || event.clientX > window.innerWidth - 24) return;
    drag.current = { x: event.clientX, y: event.clientY, t: performance.now(), id: event.pointerId };
    setCardWidth(event.currentTarget.offsetWidth || 280);
    event.currentTarget.setPointerCapture(event.pointerId);
    setMotion({ dx: 0, dy: 0, animate: "none", leaving: null });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    setMotion({ dx: event.clientX - start.x, dy: event.clientY - start.y, animate: "none", leaving: null });
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !card) return;
    drag.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.t);
    const width = event.currentTarget.offsetWidth || cardWidth;
    const direction = directionOf(dx, dy);
    const distance = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const flick = distance > 40 && distance / elapsed > FLICK_PX_PER_MS;
    if (event.type !== "pointercancel" && (distance >= width * COMMIT_SHARE || flick)) {
      commit(card, ANSWER_OF[direction], { dx, dy });
      return;
    }
    setMotion({ dx: 0, dy: 0, animate: "return", leaving: null });
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col gap-6" data-tanda="vacia">
        <TopBar eyebrow={eyebrowOf(round, epoch)} title="Las que todos vimos" />
        <p className="rounded-2xl border border-line bg-surface px-4 py-5 text-[15px] leading-snug text-fog">
          El lunes llega otra tanda. Por ahora no hay cartas nuevas para ti.
        </p>
        <Link href={JUEGOS_PATH} className={cn("self-start text-sm font-semibold text-accent", focusRing)}>
          Volver a Extras
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <Corte cards={cards} round={round} epoch={epoch} corte={corte} onMore={more} dealing={dealing} exhausted={exhausted} />
    );
  }

  const width = cardWidth;
  const horizontal = Math.abs(motion.dx) >= Math.abs(motion.dy);
  const share = (value: number) => clamp01((value / width - STAMP_FROM) / (STAMP_FULL - STAMP_FROM));
  const stampOpacity: Record<StampAnswer, number> = motion.leaving
    ? { liked: 0, no: 0, meh: 0, loved: 0, [motion.leaving]: 1 }
    : {
        liked: horizontal ? share(motion.dx) : 0,
        no: horizontal ? share(-motion.dx) : 0,
        meh: horizontal ? 0 : share(motion.dy),
        loved: horizontal ? 0 : share(-motion.dy),
      };
  const tilt = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, motion.dx / 18));
  const cardStyle: CSSProperties =
    motion.animate === "fade"
      ? { opacity: 0, transition: `opacity ${FLY_MS}ms ease-out` }
      : {
          transform: `translate3d(${motion.dx}px, ${motion.dy}px, 0) rotate(${tilt}deg)`,
          transition:
            motion.animate === "fly"
              ? `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`
              : motion.animate === "return"
                ? `transform 420ms ${RETURN_EASE}`
                : "none",
          opacity: motion.animate === "fly" ? 0.9 : 1,
        };
  const seenSoFar = cards.filter((item) => item.answer && isSeenAnswer(item.answer)).length;

  return (
    <div className="tanda-play flex flex-col" data-tanda="jugando">
      <TopBar eyebrow={eyebrowOf(round, epoch)} title="Las que todos vimos" onUndo={undo} canUndo={order.length > 0 && !busyUndo} />
      <div className="mt-3 flex items-center gap-3">
        <Strip cards={cards} current={current} />
        <span className="shrink-0 text-sm tabular-nums text-fog">
          <b className="text-paper">{current + 1}</b> de {cards.length}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {`${card!.name}. Llevas ${seenSoFar} ${seenSoFar === 1 ? "vista" : "vistas"}.`}
      </p>

      <div className="tanda-deck relative mx-auto mt-4">
        {next ? (
          <div className="absolute inset-0 overflow-hidden rounded-[1.4rem] opacity-70 [transform:rotate(-3deg)_translateY(6px)_scale(.97)]" aria-hidden="true">
            <PosterImage name="" posterPath={next.posterPath} sizes="280px" tmdbSize="w342" ratio="fill" />
          </div>
        ) : null}
        <div
          key={card!.catalogId}
          className="tanda-card absolute inset-0 cursor-grab touch-none select-none overflow-hidden rounded-[1.4rem] border border-white/10 bg-chrome shadow-[0_30px_60px_-24px_rgba(0,0,0,.95)] will-change-transform active:cursor-grabbing"
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={(event) => {
            if (drag.current) onPointerEnd(event);
          }}
          data-tanda-card={card!.catalogId}
        >
          <div className="pointer-events-none size-full [&_img]:[-webkit-user-drag:none]">
            <PosterImage name={card!.name} posterPath={card!.posterPath} sizes="280px" tmdbSize="w500" ratio="fill" priority />
          </div>
          {(Object.keys(STAMP_CLASS) as StampAnswer[]).map((answer) => (
            <span
              key={answer}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute rounded-lg border-[3px] bg-black/35 px-2.5 py-1 font-serif text-xl font-bold uppercase tracking-wide",
                STAMP_CLASS[answer],
              )}
              style={{ opacity: stampOpacity[answer] }}
            >
              {TANDA_ANSWER_LABEL[answer]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 px-2 text-center">
        <h2 className="line-clamp-2 font-serif text-[1.35rem] font-semibold leading-tight text-paper">{card!.name}</h2>
        <p className="mt-0.5 text-sm text-fog">{[card!.year, card!.director].filter(Boolean).join(" · ")}</p>
      </div>

      <div className="mt-auto grid grid-cols-4 gap-2 pt-3" role="group" aria-label="Tu respuesta">
        {BUTTON_ORDER.map((answer) => (
          <button
            key={answer}
            type="button"
            onClick={() => answerCurrent(answer)}
            disabled={Boolean(motion.leaving)}
            className={cn(
              "press-scale relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface px-1 text-xs font-semibold",
              BUTTON_TONE[answer],
              answer === "liked" && "border-success/40 bg-success-well",
              focusRing,
            )}
          >
            <span aria-hidden="true" className="absolute right-2 top-1 text-[10px] text-fog">
              {ARROW[answer]}
            </span>
            <AnswerIcon answer={answer} />
            {TANDA_ANSWER_LABEL[answer]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => answerCurrent("want")}
        disabled={Boolean(motion.leaving)}
        className={cn("mx-auto mt-1 inline-flex min-h-11 items-center px-3 text-sm font-medium text-fog hover:text-paper", focusRing)}
      >
        No la vi, quiero verla
      </button>
    </div>
  );
};
