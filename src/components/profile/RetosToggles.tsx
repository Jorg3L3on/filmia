"use client";

import { useState, useTransition } from "react";
import { setJuegosNotas, setRetosPush } from "@/app/actions/retos";
import { JuegosIcon } from "@/components/juegos/JuegosIcon";
import { ProfileRow } from "@/components/profile/ProfileRows";
import { cn } from "@/lib/cn";
import { showActionError } from "@/lib/toast-alerts";
import { focusRing } from "@/lib/ui";

const Switch = ({ on, label, disabled, onClick }: { on: boolean; label: string; disabled: boolean; onClick: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
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
);

const useSwitch = (initial: boolean, save: (next: boolean) => Promise<void>) => {
  const [on, setOn] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const toggle = () => {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      try {
        await save(next);
      } catch {
        setOn(!next);
        showActionError({ title: "No se pudo guardar", description: "Revisa tu conexión." });
      }
    });
  };
  return { on, isPending, toggle };
};

/**
 * Perfil «Te retaron» (FIL-I53-3): one push a day at most when someone sends a reto. Its own switch:
 * «Avisos de Extras» does not turn it off, nor the other way round. Only shown with push configured.
 */
export const RetosPushToggle = ({ initial }: { initial: boolean }) => {
  const { on, isPending, toggle } = useSwitch(initial, setRetosPush);
  return (
    <ProfileRow
      icon={<JuegosIcon />}
      iconClassName="bg-accent/15 text-accent"
      label="Te retaron"
      hint="Uno al día como máximo"
      value={<Switch on={on} disabled={isPending} onClick={toggle} label="Avisarme cuando alguien me rete" />}
    />
  );
};

/**
 * Perfil «Usar mis notas en juegos» (FIL-I53-6): off by default. On, Duelo de gustos may show the
 * person's own ratings to whom they duel, two films at a time and only after each answer.
 */
export const JuegosNotasToggle = ({ initial }: { initial: boolean }) => {
  const { on, isPending, toggle } = useSwitch(initial, setJuegosNotas);
  return (
    <ProfileRow
      icon={<JuegosIcon />}
      iconClassName="bg-affinity/15 text-affinity"
      label="Usar mis notas en juegos"
      hint={on ? "En Duelo de gustos, al contestar" : "Apagado: nadie las ve"}
      value={<Switch on={on} disabled={isPending} onClick={toggle} label="Permitir que Duelo de gustos use mis notas" />}
    />
  );
};
