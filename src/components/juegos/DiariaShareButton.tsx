"use client";

import { useEffect, useRef } from "react";
import { ShareIcon } from "@/components/share/ShareButton";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { DIARIAS, diariaShareText, type DiariaId } from "@/lib/juegos/diarias/core";
import { showToast } from "@/lib/toast";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass } from "@/lib/ui";

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * «Compartir resultado» of a FIL-I54 daily, the same behaviour as Mayor o menor's (FIL-I52-4): the
 * share sheet with the text and the result image, or the text to the clipboard. Neither names a
 * film. The image is fetched once the button is on screen (iOS opens the sheet only inside the tap).
 */
export const DiariaShareButton = ({ id, partidaId, day, score, marks }: { id: DiariaId; partidaId: string; day: string; score: string; marks: string }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<File | null>(null);
  const imagePath = `/extras/diarias/imagen/${partidaId}`;

  useEffect(() => {
    const button = buttonRef.current;
    if (!button || typeof navigator.share !== "function" || typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      fetch(imagePath, { cache: "no-store" })
        .then((response) => (response.ok ? response.blob() : null))
        .then((blob) => {
          if (!cancelled && blob) fileRef.current = new File([blob], `${id}.png`, { type: blob.type || "image/png" });
        })
        .catch(() => {
          // The text alone is still worth sharing.
        });
    });
    observer.observe(button);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [id, imagePath]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ title: "Resultado copiado", description: "Pégalo donde quieras compartirlo." });
    } catch {
      showActionError({ title: "No se pudo copiar", description: "Tu navegador no dejó copiar el resultado." });
    }
  };

  const share = () => {
    const text = diariaShareText({ id, day, score, marks, url: new URL(JUEGOS_PATH, window.location.origin).href });
    if (typeof navigator.share !== "function") {
      void copy(text);
      return;
    }
    const title = DIARIAS[id].name;
    const file = fileRef.current;
    const withFile = file && navigator.canShare?.({ files: [file] });
    navigator.share(withFile ? { title, text, files: [file] } : { title, text }).catch((error: unknown) => {
      if (!isAbort(error)) void copy(text);
    });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={share}
      className={buttonClass({ variant: "primary", size: "lg", className: "mt-4 w-full gap-2" })}
      data-diaria="compartir"
    >
      <ShareIcon className="size-5" />
      Compartir resultado
    </button>
  );
};
