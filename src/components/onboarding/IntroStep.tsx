"use client";

import type { RefObject } from "react";
import { Logo } from "@/components/Logo";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { staggerStyle } from "@/lib/motion-style";

type IntroStepProps = {
  userName: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

const BEATS = [
  { icon: "★", title: "Tu favorita de siempre", text: "Para saber qué te mueve." },
  { icon: "▣", title: "Lo mejor del año", text: "Marca lo que ya viste." },
  { icon: "▶", title: "Tus plataformas", text: "Hoy solo propone lo que puedes ver ya." },
  { icon: "☾", title: "Tu hora de dormir", text: "Para que la peli acabe a tiempo." },
] as const;

export const IntroStep = ({ userName, headingRef }: IntroStepProps) => {
  const first = userName?.trim().split(/\s+/)[0] ?? null;
  return (
    <div className="flex min-h-full flex-col justify-center gap-8 py-6">
      <div className="fade-up flex justify-center">
        <Logo size="lg" />
      </div>
      <StepHeader
        headingRef={headingRef}
        align="center"
        size="lg"
        eyebrow="Cine. Historias. Emociones."
        title={
          first ? (
            <>
              Hola, <span className="text-accent">{first}</span>.
              <br />
              Vamos a preparar tu sala.
            </>
          ) : (
            <>
              Bienvenido a Filmia.
              <br />
              Vamos a preparar tu sala.
            </>
          )
        }
        lede={
          <span className="mx-auto block max-w-sm text-center">
            Cuatro preguntas, menos de dos minutos. Al final, Hoy ya sabrá qué proponerte esta noche.
          </span>
        }
      />
      <ol className="mx-auto grid w-full max-w-sm gap-2.5">
        {BEATS.map((beat, index) => (
          <li
            key={beat.title}
            className="stagger-in flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 backdrop-blur-xl"
            style={staggerStyle(index + 3, 70)}
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-base text-accent ring-1 ring-accent/25"
            >
              {beat.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-paper">{beat.title}</span>
              <span className="block text-[13px] text-fog">{beat.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};
