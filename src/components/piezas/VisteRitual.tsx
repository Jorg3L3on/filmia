"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { answerViste, moreViste } from "@/app/actions/viste";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { VISTE_ANSWER_LABEL, type VisteAnswer } from "@/lib/piezas/core";
import type { VisteCard } from "@/lib/piezas/viste";
import { showToast } from "@/lib/toast";
import { showActionError, TOAST_COPY, toastPoster } from "@/lib/toast-alerts";
import { focusRing } from "@/lib/ui";

const ANSWER_CLASS: Record<VisteAnswer, string> = {
  meh: "border-[#5a2a32] bg-[#2a1618] text-[#ff8a96]",
  no: "border-line bg-chrome text-paper",
  liked: "border-success/50 bg-success-well text-success",
};

/** Deal the next three while this many are still left to answer, so there is never a wait. */
const PREFETCH_AT = 1;

/**
 * One card at a time, for as long as the person wants (no daily limit): a stack, three buttons
 * of 48 px (no stars, no numbers). Every three answered, a line says what changed and the next
 * three are already there. Leaving the page is the only way out; nothing is lost by stopping.
 */
export const VisteRitual = ({ cards: initial }: { cards: VisteCard[] }) => {
  const [cards, setCards] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, VisteAnswer>>(() =>
    Object.fromEntries(initial.flatMap((card) => (card.answer ? [[card.catalogId, card.answer]] : []))),
  );
  const [summary, setSummary] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [, startTransition] = useTransition();
  const dealing = useRef(false);
  const open = cards.filter((card) => !answers[card.catalogId]);
  const current = open[0] ?? null;
  const answeredCount = Object.keys(answers).length;

  // The next three arrive before the last one is answered.
  useEffect(() => {
    if (exhausted || dealing.current || open.length > PREFETCH_AT) {
      return;
    }
    dealing.current = true;
    void moreViste()
      .then((more) => {
        if (more.length === 0) {
          setExhausted(true);
          return;
        }
        setCards((existing) => {
          const known = new Set(existing.map((card) => card.catalogId));
          return [...existing, ...more.filter((card) => !known.has(card.catalogId))];
        });
      })
      .catch(() => setExhausted(true))
      .finally(() => {
        dealing.current = false;
      });
  }, [exhausted, open.length]);

  if (cards.length === 0 && exhausted) {
    return (
      <p className="rounded-2xl border border-line bg-surface px-4 py-5 text-[15px] leading-snug text-fog">
        No hay cartas por ahora: marca una película como vista y te preguntamos por las que van con ella.
      </p>
    );
  }

  const answer = (card: VisteCard, choice: VisteAnswer) => {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [card.catalogId]: choice }));
    setSummary(null);
    startTransition(async () => {
      const outcome = await answerViste(card.catalogId, choice);
      if (!outcome.ok) {
        setAnswers((currentAnswers) => {
          const next = { ...currentAnswers };
          delete next[card.catalogId];
          return next;
        });
        showActionError({
          title: TOAST_COPY.couldNotSave,
          description: outcome.error,
          poster: toastPoster(card.posterPath),
        });
        return;
      }
      if (choice === "no") {
        const poster = toastPoster(card.posterPath);
        showToast({
          title: TOAST_COPY.markedUnseen,
          description: card.name,
          poster,
          action: {
            label: "Quiero ver",
            onClick: () => {
              void addTitleFromTmdb({
                tmdbId: card.tmdbId,
                kind: "MOVIE",
                name: card.name,
                originalName: card.originalName,
                year: card.year,
                posterPath: card.posterPath,
                destination: "watchlist",
              }).then((saved) => {
                if (saved.ok) {
                  showToast({ title: TOAST_COPY.addedWatchlist, description: card.name, poster });
                  return;
                }
                showActionError({ title: TOAST_COPY.couldNotSave, description: saved.error, poster });
              });
            },
          },
        });
      }
      if (outcome.summary) {
        setSummary(outcome.summary);
      }
    });
  };

  if (!current) {
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface px-5 py-7 text-center">
        {exhausted ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">No quedan más por ahora</p>
            <p className="font-serif text-2xl leading-tight text-paper">{summary ?? `${answeredCount} respondidas hoy.`}</p>
            <p className="text-[13px] text-fog">Marca más películas como vistas y aparecerán otras.</p>
            <Link href="/" className={cn("press-scale mt-1 rounded-xl bg-accent px-6 py-3 text-[14px] font-semibold text-ink", focusRing)}>
              Volver a Hoy
            </Link>
          </>
        ) : (
          <p className="text-[14px] text-fog" aria-busy="true">
            Barajando otras tres…
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label={current.name} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 text-[12px] text-fog">
        <p aria-live="polite" className={cn("min-w-0 truncate", summary && "text-paper")}>
          {summary ?? (answeredCount > 0 ? `${answeredCount} ${answeredCount === 1 ? "respondida" : "respondidas"} hoy` : "Las que quieras")}
        </p>
        <Link href="/" className={cn("shrink-0 text-accent-hover", focusRing)}>
          Listo
        </Link>
      </div>
      <div className="relative mx-auto h-[330px] w-[220px]">
        {open.slice(1, 3).map((card, index) => (
          <span
            key={card.catalogId}
            aria-hidden="true"
            className="absolute inset-0 rounded-[20px] border border-line bg-chrome"
            style={{ transform: `rotate(${index === 0 ? -4 : 6}deg) translateY(${(index + 1) * 6}px)` }}
          />
        ))}
        <div key={current.catalogId} className="tonight-title-in absolute inset-0 overflow-hidden rounded-[22px] shadow-[0_24px_48px_-20px_rgb(0_0_0/0.8)]">
          <PosterImage name={current.name} posterPath={current.posterPath} sizes="220px" tmdbSize="w342" className="h-full" ratio="fill" priority />
        </div>
      </div>
      <div className="space-y-1 text-center">
        <h2 className="font-serif text-2xl leading-tight text-paper">{current.name}</h2>
        <p className="text-[13px] text-fog">{[current.year, current.director].filter(Boolean).join(" · ")}</p>
        {current.seedName ? (
          <p className="mx-auto max-w-xs text-[13px] leading-snug text-paper/75">
            Sale porque viste <em>{current.seedName}</em>.
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["meh", "no", "liked"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => answer(current, choice)}
            className={cn("press-scale min-h-12 rounded-2xl border px-2 text-[13px] font-semibold leading-tight", ANSWER_CLASS[choice], focusRing)}
          >
            {VISTE_ANSWER_LABEL[choice]}
          </button>
        ))}
      </div>
      <p className="text-center text-[12px] text-fog">«No la vi» te deja guardarla en Quiero ver. Sin estrellas ni números.</p>
    </section>
  );
};
