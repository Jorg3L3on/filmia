"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { answerAfinaCard, moreAfinaCards } from "@/app/actions/tonight";
import { PosterImage } from "@/components/PosterImage";
import type { AfinaCard } from "@/lib/cold-start-store";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { VISTE_ANSWER_LABEL, type VisteAnswer } from "@/lib/piezas/core";
import { showToast } from "@/lib/toast";
import { afinaMode, SIGNAL_GOAL } from "@/lib/tonight/cold-start";
import { focusRing } from "@/lib/ui";

const ANSWERS: { answer: VisteAnswer; label: string }[] = [
  { answer: "liked", label: "La vi y me gustó" },
  { answer: "meh", label: "La vi, no tanto" },
  { answer: "no", label: "No la he visto" },
];

/** How long the stamp shows before the card leaves (the stamp's own pop is 420 ms). */
const STAMP_MS = 520;

/**
 * «Afina tu gusto» (FIL-I47-3): one card at a time from what ranks on your platforms. Each answer is
 * a signal; under ten a meter counts them, and the tenth recomputes the deck above.
 */
export const AfinaTuGusto = ({ initialCards, initialSignals }: { initialCards: AfinaCard[]; initialSignals: number }) => {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [signals, setSignals] = useState(initialSignals);
  const [stamped, setStamped] = useState<VisteAnswer | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const mode = afinaMode(initialSignals);
  const card = cards[0];

  if (mode === "hidden" || !card) {
    return null;
  }

  const answer = (choice: VisteAnswer) => {
    if (pending || leaving) return;
    if (choice !== "no") setStamped(choice);
    startTransition(async () => {
      const outcome = await answerAfinaCard(card.catalogId, choice).catch(() => null);
      if (!outcome?.ok) {
        setStamped(null);
        showToast({ title: outcome?.error ?? "No se pudo guardar tu respuesta.", variant: "error" });
        return;
      }
      setSignals(outcome.signals);
      await new Promise((resolve) => window.setTimeout(resolve, choice === "no" ? 0 : STAMP_MS));
      setLeaving(true);
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      let rest = cards.slice(1);
      if (rest.length < 2) {
        const more = await moreAfinaCards().catch(() => []);
        const known = new Set(rest.map((entry) => entry.catalogId));
        rest = [...rest, ...more.filter((entry) => !known.has(entry.catalogId) && entry.catalogId !== card.catalogId)];
      }
      setCards(rest);
      setStamped(null);
      setLeaving(false);
      if (outcome.reachedGoal) {
        showToast({ title: "Tu mazo ya usa tu gusto", description: "Diez señales: Hoy acaba de barajar de nuevo." });
        router.refresh();
      }
    });
  };

  const progress = Math.min(signals, SIGNAL_GOAL);

  return (
    <section className={cn("act-two-block", mode === "compact" && "is-compact")} aria-labelledby="afina-title" data-act-two="afina">
      <div className="afina">
        <div className="afina-top">
          {mode === "full" ? (
            <div
              className="afina-ring"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={SIGNAL_GOAL}
              aria-valuenow={progress}
              aria-label={`${progress} de ${SIGNAL_GOAL} señales`}
              style={{ "--afina": (progress / SIGNAL_GOAL) * 100 } as CSSProperties}
            >
              {progress}/{SIGNAL_GOAL}
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 id="afina-title" className="font-serif">
              Afina tu gusto
            </h2>
            <p>
              {mode === "full"
                ? `Con ${SIGNAL_GOAL} respuestas tu mazo usa tu gusto. Lo más visto en tus plataformas.`
                : "Una respuesta más y Hoy te conoce mejor."}
            </p>
          </div>
        </div>
        <div className={cn("afina-card", leaving && "is-leaving")} key={card.catalogId} aria-live="polite">
          <div className="afina-poster">
            <PosterImage name={card.name} posterPath={card.posterPath} ratio="fill" sizes="84px" />
            {stamped ? (
              <span className="visto-stamp afina-stamp" aria-hidden="true">
                Visto
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="afina-name">{card.name}</p>
            <p className="afina-meta">
              N.º {card.rank} en {PLATFORM_SERVICE_LABEL[card.platform]} · {card.kind === "SERIES" ? "Serie" : "Película"}
              {card.year ? ` · ${card.year}` : ""}
            </p>
            <div className="afina-answers" role="group" aria-label={`¿Viste ${card.name}?`}>
              {ANSWERS.map(({ answer: value, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={pending || leaving}
                  aria-label={`${VISTE_ANSWER_LABEL[value]}: ${card.name}`}
                  onClick={() => answer(value)}
                  className={cn("afina-answer press-scale", focusRing)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
