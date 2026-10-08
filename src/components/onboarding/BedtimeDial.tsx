"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { updateNightEnds } from "@/app/actions/tonight";
import { HourDrum } from "@/components/onboarding/HourDrum";
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

const TARGETS: BedtimeTarget[] = ["weekday", "weekend"];

export type NightEndsSaveStatus = "idle" | "saving" | "saved" | "error";

/** Debounced save of the bedtime pair, shared by the Bienvenida and Perfil. */
export const useNightEndsSave = () => {
  const [status, setStatus] = useState<NightEndsSaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    },
    [],
  );

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

  return { status, persist };
};

export const nightEndsStatusCopy = (status: NightEndsSaveStatus) =>
  status === "saving"
    ? "Guardando…"
    : status === "saved"
      ? "Guardado."
      : status === "error"
        ? "No se pudo guardar."
        : "Las madrugadas (antes de las 06:00) cuentan como la noche anterior.";

type BedtimeDialProps = {
  value: NightEnds;
  onChange: (next: NightEnds) => void;
  initialTarget?: BedtimeTarget;
};

/** Night sky + moon + hour drum with the weekday / weekend switch (Bienvenida «Tu reloj», Perfil sheet). */
export const BedtimeDial = ({ value, onChange, initialTarget = "weekday" }: BedtimeDialProps) => {
  const [target, setTarget] = useState<BedtimeTarget>(initialTarget);
  const [weekendTouched, setWeekendTouched] = useState(value.weekend !== suggestWeekendFrom(value.weekday));

  const setSlot = (slot: number) => {
    const hhmm = slotToHHMM(slot);
    if (target === "weekday") {
      onChange({ weekday: hhmm, weekend: weekendTouched ? value.weekend : suggestWeekendFrom(hhmm) });
      return;
    }
    setWeekendTouched(true);
    onChange({ weekday: value.weekday, weekend: hhmm });
  };

  const current = value[target];
  const slot = hhmmToSlot(current);
  const skyStyle = { "--elev": moonElevation(slot) } as CSSProperties;

  return (
    <div className="space-y-6">
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
    </div>
  );
};
