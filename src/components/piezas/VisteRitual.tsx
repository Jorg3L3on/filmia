"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerViste } from "@/app/actions/rutas";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { VISTE_ANSWER_LABEL, type VisteAnswer } from "@/lib/piezas/core";
import type { VisteCard } from "@/lib/piezas/viste";
import { showToast } from "@/lib/toast";
import { focusRing } from "@/lib/ui";

const ANSWER_CLASS: Record<VisteAnswer, string> = {
  meh: "border-[#5a2a32] bg-[#2a1618] text-[#ff8a96]",
  no: "border-line bg-chrome text-paper",
  liked: "border-success/50 bg-success-well text-success",
};

/**
 * The three cards, one at a time: a stack, three buttons of 48 px (no stars, no numbers), and
 * after the third the line that says what changed. «No la vi» offers Quiero ver in one tap.
 */
export const VisteRitual = ({ cards }: { cards: VisteCard[] }) => {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, VisteAnswer>>(() =>
    Object.fromEntries(cards.flatMap((card) => (card.answer ? [[card.catalogId, card.answer]] : []))),
  );
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = cards.filter((card) => !answers[card.catalogId]);
  const current = open[0] ?? null;
  const position = cards.length - open.length + 1;

  if (cards.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface px-4 py-5 text-[15px] leading-snug text-fog">
        Hoy no hay cartas: marca una película como vista y mañana te preguntamos por otras.
      </p>
    );
  }

  const answer = (card: VisteCard, choice: VisteAnswer) => {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [card.catalogId]: choice }));
    startTransition(async () => {
      const outcome = await answerViste(card.catalogId, choice);
      if (!outcome.ok) {
        setAnswers((currentAnswers) => {
          const next = { ...currentAnswers };
          delete next[card.catalogId];
          return next;
        });
        showToast({ title: "No se pudo guardar", description: outcome.error, variant: "error" });
        return;
      }
      if (choice === "no") {
        showToast({
          title: "No la viste",
          description: card.name,
          durationMs: 6000,
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
              }).then((saved) =>
                showToast(saved.ok ? { title: "En Quiero ver", description: card.name } : { title: "No se pudo guardar", variant: "error" }),
              );
            },
          },
        });
      }
      if (outcome.summary) {
        setSummary(outcome.summary);
        router.refresh();
      }
    });
  };

  if (!current) {
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface px-5 py-7 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Listo por hoy</p>
        <p className="font-serif text-2xl leading-tight text-paper">{summary ?? "Las tres de hoy, respondidas."}</p>
        <p className="text-[13px] text-fog">Mañana hay otras tres.</p>
        <Link href="/" className={cn("press-scale mt-1 rounded-xl bg-accent px-6 py-3 text-[14px] font-semibold text-ink", focusRing)}>
          Volver a Hoy
        </Link>
      </section>
    );
  }

  return (
    <section aria-label={`Carta ${position} de ${cards.length}`} className="flex flex-col gap-5">
      <p className="text-right text-[12px] text-fog" aria-hidden="true">
        {position} de {cards.length}
      </p>
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
            disabled={pending && Boolean(answers[current.catalogId])}
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
