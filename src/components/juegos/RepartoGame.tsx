"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { answerRepartoTry } from "@/app/actions/diarias";
import { DiariaTitleSearch } from "@/components/juegos/DiariaTitleSearch";
import { MayorTopBar } from "@/components/juegos/MayorGame";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import type { TitleGuess } from "@/lib/juegos/diarias/core";
import type { RepartoView } from "@/lib/juegos/diarias/reparto-store";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass } from "@/lib/ui";

/** The cast list: uncovered people (the newest in gold), then the slots still covered. */
export const RepartoCast = ({ view, fresh = false }: { view: RepartoView; fresh?: boolean }) => (
  <ol className="flex flex-col gap-[0.4375rem]" aria-label="Reparto" data-reparto="reparto">
    {view.cast.map((person, index) => {
      const newest = fresh && index === view.cast.length - 1 && !view.finished && index > 0;
      return (
        <li
          key={person.id}
          className={cn("flex min-h-[3.25rem] items-center gap-3 rounded-[0.875rem] border px-3.5", newest ? "border-star/50 bg-star/10" : "border-line bg-surface")}
        >
          <span className={cn("w-6 shrink-0 font-serif font-semibold", newest ? "text-star" : "text-fog")}>{person.billing}</span>
          <b className="min-w-0 flex-1 truncate text-[15px] font-semibold text-paper">{person.name}</b>
          {newest ? (
            <span className="shrink-0 text-xs font-semibold text-star">nueva pista</span>
          ) : person.character ? (
            <span className="max-w-[40%] shrink-0 truncate text-xs text-fog">{person.character}</span>
          ) : null}
        </li>
      );
    })}
    {Array.from({ length: view.hidden }, (_, index) => {
      const billing = view.hidden - index;
      return (
        <li key={`oculto-${billing}`} className="flex min-h-[3.25rem] items-center gap-3 rounded-[0.875rem] border border-dashed border-line px-3.5 text-sm text-fog">
          <span className="w-6 shrink-0 font-serif font-semibold">{billing}</span>
          {billing === 1 ? "Quien protagoniza, al final" : "Se destapa con otro fallo"}
        </li>
      );
    })}
  </ol>
);

/**
 * Reparto misterioso's play screen (board J-3-reparto): the uncovered cast, the wrong guesses and
 * the title search. «Otra pista» spends a try to uncover the next person. When the partida ends,
 * «Ver resultado» refreshes the page into the answer and the day table.
 */
export const RepartoGame = ({ initialView }: { initialView: RepartoView }) => {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [pending, setPending] = useState(false);
  const [fresh, setFresh] = useState(false);

  const send = (guess: TitleGuess | null) => {
    if (pending || view.finished) return;
    setPending(true);
    answerRepartoTry(view.partidaId, view.step, guess)
      .then((outcome) => {
        if (!outcome.ok) {
          if (outcome.view) setView(outcome.view);
          showActionError({ title: outcome.error });
          return;
        }
        setFresh(!outcome.correct);
        setView(outcome.view);
      })
      .catch(() => showActionError({ title: "No se pudo enviar", description: "Revisa tu conexión e intenta otra vez." }))
      .finally(() => setPending(false));
  };

  return (
    <div className="flex flex-1 flex-col gap-4" data-reparto="juego">
      <MayorTopBar
        eyebrow={`n.º ${view.number} · intento ${Math.min(view.tries + 1, view.maxTries)} de ${view.maxTries}`}
        title="Reparto misterioso"
        backHref={JUEGOS_PATH}
      />
      {view.finished ? (
        <>
          <p className={cn("rounded-xl px-3 py-2 text-sm font-semibold", view.solved ? "bg-success/10 text-success" : "bg-danger/10 text-danger")} role="status">
            {view.solved ? `¡Era ${view.answer?.name ?? "esa"}!` : `Era ${view.answer?.name ?? "otra"}.`}
          </p>
          <RepartoCast view={view} />
          <div className="flex-1" />
          <button type="button" onClick={() => router.refresh()} className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })} autoFocus>
            Ver resultado
          </button>
        </>
      ) : (
        <>
          <p className="text-[15px] text-fog">¿En qué película salen? Empiezan los menos conocidos.</p>
          <RepartoCast view={view} fresh={fresh} />
          {view.misses.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Lo que no era" data-reparto="fallos">
              {view.misses.map((name, index) => (
                <li key={`${name}-${index}`} className="max-w-full truncate rounded-full border border-danger/40 px-2.5 py-1 text-xs font-semibold text-danger">
                  {name}
                </li>
              ))}
            </ul>
          ) : null}
          <DiariaTitleSearch placeholder="¿Qué película es?" disabled={pending} onPick={send} />
          <div className="flex-1" />
          <button type="button" disabled={pending} onClick={() => send(null)} className={buttonClass({ variant: "secondary", size: "lg", className: "w-full" })} data-reparto="pista">
            {view.tries + 1 >= view.maxTries ? "No sé, ver cuál era" : "Otra pista"}
          </button>
        </>
      )}
    </div>
  );
};
