"use client";

import { useEffect, useRef } from "react";
import { ShareIcon } from "@/components/share/ShareButton";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { shareText, type MayorLensId } from "@/lib/juegos/mayor/core";
import { showToast } from "@/lib/toast";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass } from "@/lib/ui";

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * «Compartir resultado» (FIL-I52-4, board M-3-diaria): the system share sheet with the text (game,
 * number, squares, a link to Extras) and the result image; without a share sheet the text goes to
 * the clipboard. Neither names a film. The image is fetched once the button is on screen, because
 * iOS only opens the sheet inside the tap's user activation.
 */
export const MayorShareButton = ({
  partidaId,
  day,
  lens,
  answers,
}: {
  partidaId: string;
  day: string;
  lens: MayorLensId;
  answers: boolean[];
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<File | null>(null);
  const imagePath = `/extras/mayor-o-menor/diaria/imagen/${partidaId}`;

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
          if (!cancelled && blob) fileRef.current = new File([blob], "mayor-o-menor.png", { type: blob.type || "image/png" });
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
  }, [imagePath]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ title: "Resultado copiado", description: "Pégalo donde quieras compartirlo." });
    } catch {
      showActionError({ title: "No se pudo copiar", description: "Tu navegador no dejó copiar el resultado." });
    }
  };

  const share = () => {
    const text = shareText({ day, lens, answers, url: new URL(JUEGOS_PATH, window.location.origin).href });
    if (typeof navigator.share !== "function") {
      void copy(text);
      return;
    }
    const file = fileRef.current;
    const withFile = file && navigator.canShare?.({ files: [file] });
    navigator.share(withFile ? { title: "Mayor o menor", text, files: [file] } : { title: "Mayor o menor", text }).catch((error: unknown) => {
      if (!isAbort(error)) void copy(text);
    });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={share}
      className={buttonClass({ variant: "primary", size: "lg", className: "mt-3 w-full gap-2" })}
      data-mayor="compartir"
    >
      <ShareIcon className="size-5" />
      Compartir resultado
    </button>
  );
};
