"use client";

import { useState, useTransition } from "react";
import { updateNightEnds } from "@/app/actions/tonight";
import { cn } from "@/lib/cn";
import type { NightEnds } from "@/lib/tonight";
import { fieldClass, wellClass } from "@/lib/ui";

type NightEndsFormProps = {
  value: NightEnds;
};

/** «Termino de ver a las»: the clock Hoy uses to say «acaba 23:19» or «se pasa 14 min». */
export const NightEndsForm = ({ value }: NightEndsFormProps) => {
  const [weekday, setWeekday] = useState(value.weekday);
  const [weekend, setWeekend] = useState(value.weekend);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const save = (next: NightEnds) => {
    const formData = new FormData();
    formData.set("weekday", next.weekday);
    formData.set("weekend", next.weekend);
    startTransition(async () => {
      try {
        await updateNightEnds(formData);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  return (
    <section id="esta-noche" className={cn(wellClass, "space-y-4 p-5")} aria-labelledby="esta-noche-h">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <MoonIcon />
          <h2 id="esta-noche-h" className="text-lg font-semibold text-paper">
            Esta noche
          </h2>
        </div>
        <p className="text-sm text-fog">
          Con esto Hoy sabe cuánto te cabe: «acaba a las 23:19» o «se pasa 14 min». Se guarda al instante.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 space-y-1.5">
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
            Entre semana
          </span>
          <input
            type="time"
            value={weekday}
            onChange={(event) => {
              setWeekday(event.target.value);
              setStatus("idle");
              if (event.target.value) {
                save({ weekday: event.target.value, weekend });
              }
            }}
            className={cn(fieldClass, "date-field")}
            aria-label="Hora a la que terminas de ver entre semana"
          />
        </label>
        <label className="min-w-0 space-y-1.5">
          <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
            Viernes y sábado
          </span>
          <input
            type="time"
            value={weekend}
            onChange={(event) => {
              setWeekend(event.target.value);
              setStatus("idle");
              if (event.target.value) {
                save({ weekday, weekend: event.target.value });
              }
            }}
            className={cn(fieldClass, "date-field")}
            aria-label="Hora a la que terminas de ver viernes y sábado"
          />
        </label>
      </div>
      <p className="text-xs text-mist" aria-live="polite">
        {isPending ? "Guardando…" : status === "saved" ? "Guardado." : status === "error" ? "No se pudo guardar." : "Las madrugadas (antes de las 06:00) cuentan como la noche anterior."}
      </p>
    </section>
  );
};

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);
