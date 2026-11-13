"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { answerTriviaQuestion, askTriviaQuestion } from "@/app/actions/retos";
import { MayorTopBar, Squares } from "@/components/juegos/MayorGame";
import { PosterImage } from "@/components/PosterImage";
import { RetoAvatar } from "@/components/juegos/RetosUi";
import { cn } from "@/lib/cn";
import { DUELOS_PATH } from "@/lib/juegos/retos/core";
import type { TriviaAnswer, TriviaView } from "@/lib/juegos/retos/trivia";
import { TRIVIA_CHIPS, TRIVIA_MS, TRIVIA_SECONDS } from "@/lib/juegos/retos/trivia-core";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

type Reveal = { choice: number; right: number; points: number; elapsedMs: number; rival: TriviaAnswer | null };

const KEYS = ["A", "B", "C", "D"];

/**
 * Duelo de trivia (FIL-I53-5, board D-1-trivia). The question appears only when the person asks for
 * it, and its 15 seconds run on the server: the bar here is a mirror of the time the server gave.
 * After answering, the right option shows, with what the rival chose if they already played.
 */
export const TriviaGame = ({
  initialView,
  rival,
  rivalAnswers,
}: {
  initialView: TriviaView;
  rival: { name: string; initial: string } | null;
  /** The rival's answers to the questions already answered (never ahead). */
  rivalAnswers: TriviaAnswer[];
}) => {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [rivalSeen, setRivalSeen] = useState<TriviaAnswer[]>(rivalAnswers);
  const [pending, setPending] = useState(false);
  const [msLeft, setMsLeft] = useState<number | null>(initialView.msLeft);
  const deadline = useRef<number | null>(null);
  const answering = useRef(false);

  // A question already handed over (a reload): its clock keeps the time the server says is left.
  useEffect(() => {
    if (initialView.msLeft != null && deadline.current == null) deadline.current = Date.now() + initialView.msLeft;
  }, [initialView.msLeft]);

  const answer = async (choice: number) => {
    if (!view.question || answering.current || reveal) return;
    answering.current = true;
    setPending(true);
    try {
      const outcome = await answerTriviaQuestion(view.partidaId, view.index, choice);
      if (!outcome.ok) {
        if (outcome.view) {
          setView(outcome.view);
          deadline.current = outcome.view.msLeft != null ? Date.now() + outcome.view.msLeft : null;
        } else showActionError({ title: "No se pudo contestar", description: outcome.error });
        return;
      }
      deadline.current = null;
      setMsLeft(null);
      setReveal({ choice, right: outcome.right, points: outcome.points, elapsedMs: outcome.elapsedMs, rival: outcome.rival ?? null });
      if (outcome.rival) setRivalSeen((seen) => [...seen.slice(0, view.index), outcome.rival!]);
      setView((current) => ({ ...outcome.view, question: current.question }));
    } catch {
      showActionError({ title: "Sin conexión", description: "Tu duelo sigue guardado. Vuelve a intentarlo." });
    } finally {
      answering.current = false;
      setPending(false);
    }
  };

  // The visible clock: mirrors the server's time; at zero it sends «no answer».
  useEffect(() => {
    if (deadline.current == null || reveal) return;
    const tick = window.setInterval(() => {
      const left = Math.max(0, deadline.current! - Date.now());
      setMsLeft(left);
      if (left === 0) {
        window.clearInterval(tick);
        void answer(-1);
      }
    }, 200);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restarts per question only
  }, [view.question?.prompt, reveal]);

  const ask = async () => {
    setPending(true);
    try {
      const next = await askTriviaQuestion(view.partidaId, view.index);
      if (!next) return;
      setReveal(null);
      setView(next);
      deadline.current = next.msLeft != null ? Date.now() + next.msLeft : null;
      setMsLeft(next.msLeft);
    } catch {
      showActionError({ title: "Sin conexión", description: "Revisa tu conexión y vuelve a intentarlo." });
    } finally {
      setPending(false);
    }
  };

  const finished = view.finished;
  // The last answer stays on screen a moment, then the server-rendered result takes over.
  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(() => router.refresh(), reveal ? 1800 : 0);
    return () => window.clearTimeout(timer);
  }, [finished, reveal, router]);

  const rivalScore = rivalSeen.reduce((sum, item) => sum + item.points, 0);
  const question = view.question;
  const number = Math.min(view.index + (reveal ? 0 : 1), view.total);

  return (
    <div className="flex flex-1 flex-col gap-4" data-trivia={finished ? "fin" : question ? (reveal ? "contestada" : "pregunta") : "espera"}>
      <MayorTopBar
        eyebrow={`Pregunta ${reveal ? view.index : number} de ${view.total}`}
        title="Duelo de trivia"
        backHref={DUELOS_PATH}
        backLabel="Salir del duelo"
      />
      <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2" aria-label="Marcador">
        <RetoAvatar initial="T" me size="sm" />
        <span className="text-sm text-fog">Tú</span>
        <b className="font-serif text-lg font-semibold tabular-nums text-paper" data-trivia="mis-puntos">
          {view.score}
        </b>
        <i className="flex-1 text-center font-serif text-sm text-fog">vs</i>
        {rival ? (
          <>
            <b className="font-serif text-lg font-semibold tabular-nums text-affinity">{rivalSeen.length ? rivalScore : "—"}</b>
            <span className="max-w-20 truncate text-sm text-fog">{rival.name}</span>
            <RetoAvatar initial={rival.initial} seed={rival.name} size="sm" />
          </>
        ) : (
          <span className="text-sm text-fog">Juegas primero</span>
        )}
      </div>

      {question ? (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-chrome" role="timer" aria-label={`${Math.ceil((msLeft ?? 0) / 1000)} segundos`}>
            <b
              className={cn(
                "block h-full rounded-full",
                reveal ? "transition-none" : "transition-[width] duration-200 ease-linear",
                (msLeft ?? 0) < 5000 ? "bg-danger" : "bg-accent",
              )}
              style={{ width: `${reveal ? 0 : Math.max(0, Math.min(100, ((msLeft ?? 0) / TRIVIA_MS) * 100))}%` }}
            />
          </div>
          <div className="flex items-start gap-3.5">
            {question.posterPath ? (
              <span className="block w-[5.25rem] shrink-0 overflow-hidden rounded-xl shadow-[0_16px_30px_-16px_rgba(0,0,0,.9)]">
                <PosterImage name={question.label} posterPath={question.posterPath} sizes="84px" tmdbSize="w185" ratio="poster" />
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="self-start rounded-full border border-line bg-chrome px-2.5 py-0.5 text-xs font-semibold text-fog">{TRIVIA_CHIPS[question.kind]}</span>
              <h2 className="font-serif text-[1.35rem] font-semibold leading-snug text-paper">{question.prompt}</h2>
            </div>
          </div>
          <div className="flex flex-col gap-2" role="group" aria-label="Opciones">
            {question.options.map((choice, index) => {
              const isRight = reveal?.right === index;
              const isMine = reveal?.choice === index;
              const rivalHere = reveal?.rival?.choice === index;
              return (
                <button
                  key={`${choice.label}-${index}`}
                  type="button"
                  onClick={() => answer(index)}
                  disabled={pending || reveal != null}
                  className={cn(
                    "flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl border px-3.5 text-left text-[15px] font-semibold transition-colors",
                    !reveal && "border-line bg-surface text-paper hover:border-line-hover",
                    reveal && isRight && "border-success/70 bg-success/15 text-paper",
                    reveal && isMine && !isRight && "border-danger/70 bg-danger/10 text-paper",
                    reveal && !isRight && !isMine && "border-line bg-surface text-fog opacity-60",
                    focusRing,
                  )}
                  data-opcion={index}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs text-fog">{KEYS[index]}</span>
                  <span className="min-w-0 flex-1">{choice.label}</span>
                  {reveal && isMine ? (
                    <span className={cn("shrink-0 text-xs font-semibold", reveal.points > 0 ? "text-success" : "text-fog")}>
                      {reveal.points > 0 ? `+${reveal.points} · ${Math.max(1, Math.round(reveal.elapsedMs / 1000))} s` : "0"}
                    </span>
                  ) : null}
                  {rivalHere && rival ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-fog">
                      <RetoAvatar initial={rival.initial} seed={rival.name} size="sm" /> {rival.name}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : !finished ? (
        <div className="flex flex-col gap-3 rounded-[1.4rem] border border-line bg-surface p-4" data-trivia="intro">
          <h2 className="font-serif text-xl font-semibold text-paper">{view.index === 0 ? "Cinco preguntas, las mismas para los dos" : `Vas en la ${view.index + 1} de ${view.total}`}</h2>
          <p className="text-sm text-fog">
            Cada una dura {TRIVIA_SECONDS} segundos y cuenta desde que aparece. Entre más rápido aciertes, más puntos.
          </p>
        </div>
      ) : null}

      <div className="flex-1" />

      {reveal && reveal.choice === -1 ? <p className="text-center text-sm text-fog">Se acabó el tiempo en esta.</p> : null}
      {reveal && reveal.rival && rival ? (
        <p className="text-center text-sm text-fog" aria-live="polite">
          {reveal.rival.points > 0 ? `${rival.name} acertó esta (+${reveal.rival.points}).` : `${rival.name} falló esta.`}
        </p>
      ) : null}

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
        <Squares answers={view.answered.map((item) => item.points > 0)} total={view.total} />
        <span className="flex-1 text-right text-xs text-fog">{view.score} puntos</span>
      </div>

      {finished ? (
        <p className="pb-2 text-center text-sm text-fog" aria-live="polite">
          Contando tus puntos…
        </p>
      ) : (!question || reveal) ? (
        <button
          type="button"
          onClick={() => (reveal && view.finished ? router.refresh() : ask())}
          disabled={pending}
          className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}
          data-trivia="siguiente"
        >
          {view.index === 0 && !reveal ? "Empezar" : reveal ? "Siguiente pregunta" : "Seguir"}
        </button>
      ) : null}
    </div>
  );
};
