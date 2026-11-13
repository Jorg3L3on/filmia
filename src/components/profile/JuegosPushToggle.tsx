"use client";

import { useState, useTransition } from "react";
import { setJuegosPush } from "@/app/actions/juegos";
import { JuegosIcon } from "@/components/juegos/JuegosIcon";
import { ProfileRow } from "@/components/profile/ProfileRows";
import { cn } from "@/lib/cn";
import { showActionError } from "@/lib/toast-alerts";
import { focusRing } from "@/lib/ui";

/**
 * Perfil «Avisos de Extras» (FIL-I50-5): the weekly tanda and a new game, at most one a week plus
 * one per launch. Its own switch: turning it off leaves «Avisos de Quiero ver» as it is. It only
 * reaches devices where «Avisos» are on.
 */
export const JuegosPushToggle = ({ initial }: { initial: boolean }) => {
  const [on, setOn] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const toggle = () => {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      try {
        await setJuegosPush(next);
      } catch {
        setOn(!next);
        showActionError({ title: "No se pudo guardar", description: "Revisa tu conexión." });
      }
    });
  };
  return (
    <ProfileRow
      icon={<JuegosIcon />}
      iconClassName="bg-accent/15 text-accent"
      label="Avisos de Extras"
      hint="Tu tanda de la semana · Lo nuevo en Extras"
      value={
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Avisarme de la tanda de la semana y de lo nuevo en Extras"
          disabled={isPending}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-[background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] disabled:opacity-50",
            "after:absolute after:-inset-2 after:content-['']",
            on ? "bg-accent" : "bg-chrome",
            focusRing,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block size-6 rounded-full bg-paper shadow transition-transform duration-[var(--duration-hover)] ease-[var(--ease-out)]",
              on ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </button>
      }
    />
  );
};
