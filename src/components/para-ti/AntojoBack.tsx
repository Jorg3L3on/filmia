"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { BackDisc } from "@/components/PageHeader";

export const FROM_OPENING_KEY = "filmia:para-ti-desde-portada";

/** Marks that an antojo was opened from the opening screen, so «atrás» can be a real back. */
export const markFromOpening = () => {
  try {
    window.sessionStorage.setItem(FROM_OPENING_KEY, "1");
  } catch {
    // Private mode: «atrás» is a plain link.
  }
};

/**
 * Back to «¿Qué se te antoja?» (FIL-I60-4). When the antojo was opened from there it is the
 * browser's back (one history entry, scroll kept); otherwise a link to the opening screen.
 */
export const AntojoBack = () => {
  const router = useRouter();
  const onClick = (event: MouseEvent) => {
    let fromOpening = false;
    try {
      fromOpening = window.sessionStorage.getItem(FROM_OPENING_KEY) === "1";
      window.sessionStorage.removeItem(FROM_OPENING_KEY);
    } catch {
      // Fall through to the link.
    }
    if (fromOpening && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  };
  return (
    <span onClickCapture={onClick} className="contents">
      <BackDisc href="/para-ti" label="Volver a ¿Qué se te antoja?" />
    </span>
  );
};
