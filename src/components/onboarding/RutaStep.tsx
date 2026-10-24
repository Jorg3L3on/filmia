"use client";

import { useEffect, useState, useTransition, type RefObject } from "react";
import { loadFirstRutas } from "@/app/actions/rutas";
import { ShimmerBlock } from "@/components/PageSkeletons";
import { PosterImage } from "@/components/PosterImage";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { cn } from "@/lib/cn";
import type { FirstRutas } from "@/lib/rutas/factories";
import { focusRing } from "@/lib/ui";

type RutaStepProps = {
  data: FirstRutas | null;
  onData: (data: FirstRutas) => void;
  /** The ruta «Empezar esta ruta» starts: the first one unless another is picked. */
  selected: string | null;
  onSelect: (sourceKey: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

/**
 * R6 · «Tu primera ruta» (FIL-I26-2): the Bienvenida's last screen. Where your favorita (or your
 * best rated) leads, three posters around the next one, and two other ways in. Nothing is built
 * until a tap; «Entrar sin ruta» lives in the footer.
 */
export const RutaStep = ({ data, onData, selected, onSelect, headingRef }: RutaStepProps) => {
  const [, startLoad] = useTransition();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (data) {
      return;
    }
    startLoad(async () => {
      try {
        const result = await loadFirstRutas();
        onData(result);
        const first = result.main?.sourceKey ?? result.alternatives[0]?.sourceKey;
        if (first) {
          onSelect(first);
        }
      } catch {
        setFailed(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, [data]);

  const main = data?.main ?? null;
  const seedName = main?.seed?.name ?? null;
  const empty = (data && !main && data.alternatives.length === 0) || failed;

  return (
    <div className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        eyebrow="Tu primera ruta"
        title={
          main && seedName ? (
            <>
              {main.seed?.favorite ? "Tu favorita es " : "Empezaste por "}
              <em className="text-accent">{seedName}</em>. Esto es lo que sigue.
            </>
          ) : empty ? (
            "Tu primera ruta llega pronto"
          ) : (
            "Esto es lo que sigue"
          )
        }
        lede={
          main
            ? `${main.reason} No hay que calificar nada.`
            : empty
              ? "Cuando marques un par de películas como vistas, Hoy te propondrá por dónde seguir."
              : data
                ? "Elige por dónde empezar. Cada una que veas voltea la siguiente."
                : "Buscando por dónde seguir…"
        }
      />

      {!data && !failed ? (
        <div className="flex items-end justify-center gap-2" aria-busy="true" aria-label="Preparando tu primera ruta">
          <ShimmerBlock className="aspect-[2/3] w-[86px] rounded-xl" />
          <ShimmerBlock className="aspect-[2/3] w-[110px] rounded-2xl" />
          <ShimmerBlock className="aspect-[2/3] w-[70px] rounded-xl" />
        </div>
      ) : null}

      {main ? (
        <button
          type="button"
          onClick={() => onSelect(main.sourceKey)}
          aria-pressed={selected === main.sourceKey}
          className={cn(
            "fade-up-late flex w-full flex-col items-center gap-3 rounded-3xl border px-3 py-4 text-center transition-colors",
            selected === main.sourceKey ? "border-accent/70 bg-white/[0.05]" : "border-white/10",
            focusRing,
          )}
        >
          <span className="text-[13px] font-semibold text-paper">{main.title}</span>
          <span className="flex items-end justify-center gap-2" aria-hidden="true">
            {main.steps.map((step, index) => {
              const isNext = !step.seen && main.steps.slice(0, index).every((item) => item.seen);
              if (!step.seen && !isNext) {
                return (
                  <span key={index} className="flex aspect-[2/3] w-[70px] items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] font-serif text-2xl text-faint">
                    ?
                  </span>
                );
              }
              return (
                <span
                  key={index}
                  className={cn(
                    "relative overflow-hidden rounded-xl",
                    isNext ? "w-[110px] ring-1 ring-accent shadow-[0_20px_40px_-18px_rgb(0_0_0/0.8)]" : "w-[86px] ring-1 ring-success/70",
                  )}
                >
                  <PosterImage name={step.name} posterPath={step.posterPath} sizes={isNext ? "110px" : "86px"} tmdbSize="w342" />
                  <span className={cn("absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", isNext ? "text-accent-hover" : "text-success")}>
                    {isNext ? "Esta noche" : "La tuya"}
                  </span>
                </span>
              );
            })}
          </span>
          {main.next ? <span className="text-[13px] leading-snug text-paper/85">{main.nextWhy ?? main.next.name}</span> : null}
        </button>
      ) : null}

      {data && data.alternatives.length > 0 ? (
        <section aria-labelledby="ruta-otras" className="fade-up-late space-y-2">
          <h2 id="ruta-otras" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">
            {main ? "O empieza por otra" : "Por dónde empezar"}
          </h2>
          <ul className="space-y-2">
            {data.alternatives.map((offer) => (
              <li key={offer.sourceKey}>
                <button
                  type="button"
                  onClick={() => onSelect(offer.sourceKey)}
                  aria-pressed={selected === offer.sourceKey}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                    selected === offer.sourceKey ? "border-accent/70 bg-white/[0.05]" : "border-white/10 bg-white/[0.02]",
                    focusRing,
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-[13px] font-semibold text-paper/85">
                    {offer.total}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] text-paper">
                    <span className="block truncate">{offer.title}</span>
                    <span className="block truncate text-[12px] text-fog">
                      {offer.done > 0 ? `Llevas ${offer.done}` : `${offer.total} películas`}
                      {offer.next ? ` · sigue ${offer.next.name}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
