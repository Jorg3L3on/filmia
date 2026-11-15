"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { makeMayorLink, sendMayorStreak, startDuel } from "@/app/actions/retos";
import { RetoAvatar } from "@/components/juegos/RetosUi";
import { cn } from "@/lib/cn";
import { RETO_MAX_OPEN_TO_SAME, retoPath, type RetoJuegoId } from "@/lib/juegos/retos/core";
import type { Retable } from "@/lib/juegos/retos/store";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

/**
 * «¿A quién?» (board Comp-3-reto): one person one already knows in Filmia, or a link (Mayor o menor with a
 * finished streak only). With a streak the reto goes out at once; a duel opens for the sender to
 * play first.
 */
export const RetoPicker = ({
  juego,
  people,
  partidaId,
  lens,
}: {
  juego: RetoJuegoId;
  people: Retable[];
  /** A finished free streak of Mayor o menor: sent as it is. */
  partidaId?: string | null;
  lens?: string | null;
}) => {
  const router = useRouter();
  const first = people.find((person) => !person.full) ?? null;
  const [selected, setSelected] = useState<string | null>(first?.userId ?? null);
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const chosen = people.find((person) => person.userId === selected) ?? null;

  const send = async () => {
    if (!chosen || pending) return;
    setPending(true);
    try {
      const outcome = partidaId ? await sendMayorStreak(partidaId, chosen.userId) : await startDuel(juego, chosen.userId, { lens: lens ?? undefined });
      if (!outcome.ok) {
        showActionError({ title: "No se pudo retar", description: outcome.error });
        return;
      }
      router.push(retoPath(outcome.retoId));
    } catch {
      showActionError({ title: "Sin conexión", description: "Revisa tu conexión y vuelve a intentarlo." });
    } finally {
      setPending(false);
    }
  };

  const makeLink = async () => {
    if (!partidaId || pending) return;
    setPending(true);
    try {
      const outcome = await makeMayorLink(partidaId);
      if (!outcome.ok) {
        showActionError({ title: "No se pudo crear el enlace", description: outcome.error });
        return;
      }
      const url = `${window.location.origin}${outcome.path}`;
      setLink(url);
      if (navigator.share) {
        await navigator.share({ title: "Te reto en Filmia", text: "¿Llegas más lejos que yo en Mayor o menor?", url }).catch(() => undefined);
      }
    } catch {
      showActionError({ title: "Sin conexión", description: "Revisa tu conexión y vuelve a intentarlo." });
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // The text is on screen and selectable.
    }
  };

  return (
    <div className="flex flex-col gap-4" data-retos="elegir">
      <h2 className="font-serif text-xl font-semibold text-paper">¿A quién?</h2>
      {people.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-4 text-[15px] leading-snug text-fog" data-retos="sin-nadie">
          {juego === "gustos"
            ? "Nadie de tu gente permite usar sus notas en juegos todavía. Cuando alguien lo encienda en su Perfil, aparecerá aquí."
            : juego === "mayor" && partidaId
              ? "Aquí aparece quien comparte una lista o un grupo de quiniela contigo, o con quien ya jugaste un duelo. A alguien más, mándale un enlace."
              : "Aquí aparece quien comparte una lista o un grupo de quiniela contigo, o con quien ya jugaste un duelo. Comparte una lista con alguien para poder retarle."}
        </p>
      ) : (
        <div role="radiogroup" aria-label="Persona a retar" className="flex flex-col">
          {people.map((person, index) => {
            const on = person.userId === selected;
            return (
              <button
                key={person.userId}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={person.full}
                onClick={() => setSelected(person.userId)}
                className={cn("flex min-h-[3.75rem] w-full items-center gap-3 text-left disabled:opacity-50", index > 0 && "border-t border-line", focusRing)}
              >
                <RetoAvatar initial={person.initial} seed={person.name} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-[15px] font-semibold text-paper">{person.name}</b>
                  <span className="truncate text-sm text-fog">
                    {person.full ? `Ya tiene ${RETO_MAX_OPEN_TO_SAME} retos tuyos por jugar` : person.line}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                    on ? "border-accent bg-accent text-[#1c0c04]" : "border-line",
                  )}
                >
                  {on ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {juego === "mayor" && partidaId ? (
        <div className="rounded-2xl border border-line bg-surface px-3.5 py-3" data-retos="enlace">
          {link ? (
            <div className="flex flex-col gap-2">
              <b className="text-sm font-semibold text-paper">Tu enlace, por 48 horas</b>
              <input readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-lg border border-line bg-well px-2.5 py-2 text-xs text-paper" aria-label="Enlace del reto" />
              <button type="button" onClick={copy} className={buttonClass({ variant: "secondary", size: "md" })}>
                Copiar enlace
              </button>
            </div>
          ) : (
            <button type="button" onClick={makeLink} disabled={pending} className={cn("flex w-full items-center gap-3 text-left", focusRing)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5 shrink-0 text-accent">
                <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
              </svg>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-[15px] font-semibold text-paper">Mandar un enlace</b>
                <span className="text-xs text-fog">Para quien todavía no tiene Filmia: juega sin cuenta.</span>
              </span>
            </button>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={send}
          disabled={!chosen || chosen.full || pending}
          className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}
          data-retos="mandar"
        >
          {chosen ? (partidaId ? `Retar a ${chosen.name}` : `Jugar y retar a ${chosen.name}`) : "Elige a alguien"}
        </button>
        <p className="text-center text-xs text-fog">Tiene 48 horas. Si no juega, el reto se borra sin castigo.</p>
      </div>
    </div>
  );
};
