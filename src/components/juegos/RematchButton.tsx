"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startDuel } from "@/app/actions/retos";
import { retoPath, type RetoJuegoId } from "@/lib/juegos/retos/core";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass } from "@/lib/ui";

/** «Revancha» (FIL-I53-7): a new reto toward the same person, with new content; the person plays first. */
export const RematchButton = ({ juego, toUserId, retoId, lens }: { juego: RetoJuegoId; toUserId: string; retoId: string; lens: string }) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const rematch = async () => {
    setPending(true);
    try {
      const outcome = await startDuel(juego, toUserId, { rematchOf: retoId, lens });
      if (!outcome.ok) {
        showActionError({ title: "No se pudo empezar la revancha", description: outcome.error });
        return;
      }
      router.push(retoPath(outcome.retoId));
    } catch {
      showActionError({ title: "Sin conexión", description: "Revisa tu conexión y vuelve a intentarlo." });
    } finally {
      setPending(false);
    }
  };
  return (
    <button type="button" onClick={rematch} disabled={pending} className={buttonClass({ variant: "primary", size: "lg", className: "flex-[1.3]" })} data-retos="revancha">
      Revancha
    </button>
  );
};
