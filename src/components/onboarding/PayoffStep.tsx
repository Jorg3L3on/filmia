"use client";

import { useEffect, useState, useTransition, type CSSProperties, type RefObject } from "react";
import { loadOnboardingPayoff } from "@/app/actions/onboarding";
import { ImdbBadge } from "@/components/ImdbBadge";
import { ShimmerBlock } from "@/components/PageSkeletons";
import { PlatformLogo } from "@/components/PlatformLogo";
import { PosterImage } from "@/components/PosterImage";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { PLATFORM_SERVICE_LABEL, TITLE_KIND_LABEL } from "@/lib/labels";
import { PAYOFF_EMPTY_COPY, type PayoffPayload } from "@/lib/onboarding/payoff";
import { formatRuntimeShort } from "@/lib/tonight/time";

type PayoffStepProps = {
  payload: PayoffPayload | null;
  onPayload: (payload: PayoffPayload) => void;
  onAmbient: (ambient: string | null, posterPath: string | null) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export const PayoffStep = ({ payload, onPayload, onAmbient, headingRef }: PayoffStepProps) => {
  const [, startLoad] = useTransition();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (payload) {
      return;
    }
    startLoad(async () => {
      try {
        const result = await loadOnboardingPayoff(new Date().toISOString());
        onPayload(result);
        if (result.kind === "card") {
          onAmbient(result.card.posterAmbient, result.card.posterPath);
        }
      } catch {
        setFailed(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, [payload]);

  return (
    <div className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        align="center"
        eyebrow="Listo"
        title={
          payload?.kind === "card" ? (
            <>
              Tu primera <span className="text-accent">noche</span>
            </>
          ) : (
            "Tu sala está lista"
          )
        }
        lede={
          payload?.kind === "card" ? (
            <span className="mx-auto block text-center">Esto es lo que Hoy te propondría ahora mismo.</span>
          ) : payload?.kind === "empty" ? (
            <span className="mx-auto block text-center">{PAYOFF_EMPTY_COPY[payload.empty].description}</span>
          ) : failed ? (
            <span className="mx-auto block text-center">No pudimos preparar la función. Hoy lo intentará de nuevo al entrar.</span>
          ) : (
            <span className="mx-auto block text-center">Preparando tu primera noche…</span>
          )
        }
      />

      {payload?.kind === "card" ? (
        <PayoffCardView payload={payload} />
      ) : payload?.kind === "empty" || failed ? (
        <div className="mx-auto max-w-sm rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-6 text-center backdrop-blur-xl">
          <p className="font-serif text-2xl text-paper">
            {payload?.kind === "empty" ? PAYOFF_EMPTY_COPY[payload.empty].title : "Casi"}
          </p>
          <p className="mt-2 text-sm text-fog">Entra a Filmia y sigue desde Buscar o Perfil cuando quieras.</p>
        </div>
      ) : (
        <div className="payoff-card mx-auto flex max-w-sm items-end gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl" aria-busy="true" aria-label="Preparando tu primera noche">
          <ShimmerBlock className="aspect-[2/3] w-32 shrink-0 rounded-poster" />
          <div className="flex-1 space-y-2 pb-1">
            <ShimmerBlock className="h-3 w-20 rounded-full" />
            <ShimmerBlock className="h-7 w-40 rounded-xl" />
            <ShimmerBlock className="h-4 w-28 rounded-full" />
            <ShimmerBlock className="h-7 w-44 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};

const PayoffCardView = ({ payload }: { payload: Extract<PayoffPayload, { kind: "card" }> }) => {
  const { card } = payload;
  const meta = [card.year, card.kind === "SERIES" ? TITLE_KIND_LABEL.SERIES : null, ...card.genres].filter(Boolean).join(" · ");
  const runtime = formatRuntimeShort(card.runtimeMinutes);
  const style = { "--que-ver-glow": card.posterAmbient ?? "var(--accent-rgb)" } as CSSProperties;
  return (
    <section className="payoff-card payoff-card-in mx-auto max-w-sm space-y-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl" style={style} aria-label="Tu elección de esta noche">
      <div className="flex items-end gap-4">
        <div className="payoff-poster relative w-32 shrink-0 overflow-hidden rounded-poster shadow-[0_22px_48px_rgba(0,0,0,0.6)]">
          <PosterImage name={card.name} posterPath={card.posterPath} priority sizes="128px" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Esta noche</p>
          <h2 className="font-serif text-2xl leading-tight text-paper">{card.name}</h2>
          {meta ? <p className="text-sm text-fog">{meta}</p> : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {card.imdbRating != null ? <ImdbBadge rating={card.imdbRating} compact /> : null}
            {card.platform ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-paper/85">
                <PlatformLogo platform={card.platform} size={18} className="rounded" />
                {PLATFORM_SERVICE_LABEL[card.platform]}
              </span>
            ) : card.providerName ? (
              <span className="text-xs text-paper/85">{card.providerName}</span>
            ) : null}
          </div>
        </div>
      </div>
      {card.reason ? (
        <p className="tonight-reason mx-auto w-fit max-w-full">
          <SparkIcon />
          <span className="truncate">{card.reason}</span>
        </p>
      ) : null}
      <p className="text-center text-sm text-paper/85">
        {card.endsAt && card.night
          ? card.overflowMinutes > 0
            ? `Si empiezas ahora acaba a las ${card.endsAt} · se pasa ${card.overflowMinutes} min de tu hora`
            : `Si empiezas ahora acaba a las ${card.endsAt}, antes de tu hora (${card.nightEndsAt}).`
          : runtime
            ? `${runtime} · tu hora de dormir es a las ${card.nightEndsAt}.`
            : `Tu hora de dormir es a las ${card.nightEndsAt}.`}
      </p>
    </section>
  );
};

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden="true">
    <path d="M12 2l1.8 5.6L19.5 9.4l-5.7 1.8L12 17l-1.8-5.8L4.5 9.4l5.7-1.8L12 2Zm6.5 11 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
  </svg>
);
