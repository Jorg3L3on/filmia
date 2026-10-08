"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { updateNightEnds } from "@/app/actions/tonight";
import { HourDrum } from "@/components/onboarding/HourDrum";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { cn } from "@/lib/cn";
import {
  BEDTIME_TARGET_LABEL,
  bedtimeCopy,
  hhmmToSlot,
  moonElevation,
  slotToHHMM,
  suggestWeekendFrom,
  type BedtimeTarget,
} from "@/lib/onboarding/bedtime";
import type { NightEnds } from "@/lib/tonight/types";
import { focusRing } from "@/lib/ui";

type BedtimeStepProps = {
  value: NightEnds;
  onChange: (next: NightEnds) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

const TARGETS: BedtimeTarget[] = ["weekday", "weekend"];

export const BedtimeStep = ({ value, onChange, headingRef }: BedtimeStepProps) => {
  const [target, setTarget] = useState<BedtimeTarget>("weekday");
  const [weekendTouched, setWeekendTouched] = useState(value.weekend !== suggestWeekendFrom(value.weekday));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (next: NightEnds) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    setStatus("saving");
    saveTimer.current = setTimeout(async () => {
      const formData = new FormData();
      formData.set("weekday", next.weekday);
      formData.set("weekend", next.weekend);
      try {
        await updateNightEnds(formData);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 350);
  };

  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    },
    [],
  );

  const setSlot = (slot: number) => {
    const hhmm = slotToHHMM(slot);
    let next: NightEnds;
    if (target === "weekday") {
      next = { weekday: hhmm, weekend: weekendTouched ? value.weekend : suggestWeekendFrom(hhmm) };
    } else {
      setWeekendTouched(true);
      next = { weekday: value.weekday, weekend: hhmm };
    }
    onChange(next);
    persist(next);
  };

  const current = value[target];
  const slot = hhmmToSlot(current);
  const elevation = moonElevation(slot);
  const skyStyle = { "--elev": elevation } as CSSProperties;

  return (
    <div className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        eyebrow="Tu reloj"
        title={
          <>
            ¿Hasta qué hora <span className="text-accent">ves</span>?
          </>
        }
        lede="Con esto Hoy te dice si termina a tiempo: «acaba a las 23:19» o «se pasa 14 min»."
      />

      <div role="tablist" aria-label="Qué noches" className="mx-auto flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] p-1 backdrop-blur-xl">
        {TARGETS.map((item) => (
          <button
            key={item}
            role="tab"
            type="button"
            aria-selected={target === item}
            onClick={() => setTarget(item)}
            className={cn(
              "tab-transition rounded-full px-4 py-1.5 text-sm font-medium",
              target === item ? "bg-accent text-ink shadow" : "text-fog hover:text-paper",
              focusRing,
            )}
          >
            {BEDTIME_TARGET_LABEL[item]}
          </button>
        ))}
      </div>

      <section className="bedtime-sky relative overflow-hidden rounded-3xl border border-white/10" style={skyStyle} aria-label="Hora a la que terminas de ver">
        <div className="bedtime-stars" aria-hidden="true" />
        <div className="bedtime-moon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-9" fill="currentColor">
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-1 px-4 pt-6 pb-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-paper/70">{BEDTIME_TARGET_LABEL[target]}</p>
          <p className="bedtime-value font-serif text-6xl leading-none tracking-tight text-paper" aria-live="polite" aria-atomic="true">
            <span key={current} className="bedtime-digits inline-block">
              {current}
            </span>
          </p>
          <p className="text-sm text-paper/80">{bedtimeCopy(current)}</p>
        </div>
        <div className="relative z-10 px-2 pb-4">
          <HourDrum slot={slot} onSlot={setSlot} label={`Hora a la que terminas de ver ${BEDTIME_TARGET_LABEL[target].toLowerCase()}`} />
        </div>
      </section>

      <p className="min-h-5 text-center text-xs text-mist" aria-live="polite">
        {status === "saving"
          ? "Guardando…"
          : status === "saved"
            ? "Guardado."
            : status === "error"
              ? "No se pudo guardar."
              : "Las madrugadas (antes de las 06:00) cuentan como la noche anterior."}
      </p>
    </div>
  );
};
