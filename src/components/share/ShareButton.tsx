"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { showToast } from "@/lib/toast";

type ShareButtonProps = {
  /** `/compartir/…` path of the public page (signed on the server). */
  path: string;
  title: string;
  text: string;
  /** Name of the shared card image, e.g. «athena.png». */
  fileName: string;
  /** The image to attach; the page's OG card by default (a 9:16 story for compat). */
  imagePath?: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

const copyLink = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url);
    showToast({ title: "Enlace copiado", description: "Pégalo donde quieras compartirlo." });
  } catch {
    showToast({ title: "No se pudo copiar el enlace", description: url, variant: "error", durationMs: 8000 });
  }
};

/**
 * Compartir (FIL-I15-5): the system share sheet with the card image (the OG
 * PNG) and the public link; without `navigator.share` it copies the link.
 * The image is fetched once the button is on screen, because iOS only opens the
 * sheet inside the tap's user activation, so the click itself never waits.
 */
export const ShareButton = ({
  path,
  title,
  text,
  fileName,
  imagePath,
  className,
  ariaLabel,
  children,
}: ShareButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button || typeof navigator.share !== "function" || typeof IntersectionObserver === "undefined") {
      return;
    }
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      observer.disconnect();
      fetch(imagePath ?? `${path}/opengraph-image`, { cache: "no-store" })
        .then((response) => (response.ok ? response.blob() : null))
        .then((blob) => {
          if (!cancelled && blob) {
            fileRef.current = new File([blob], fileName, { type: blob.type || "image/png" });
          }
        })
        .catch(() => {
          // The link alone is still worth sharing.
        });
    });
    observer.observe(button);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [path, fileName, imagePath]);

  const share = () => {
    const url = new URL(path, window.location.origin).href;
    if (typeof navigator.share !== "function") {
      void copyLink(url);
      return;
    }
    const file = fileRef.current;
    const withFile = file && navigator.canShare?.({ files: [file] });
    navigator
      .share(withFile ? { title, text, url, files: [file] } : { title, text, url })
      .catch((error: unknown) => {
        if (!isAbort(error)) {
          void copyLink(url);
        }
      });
  };

  return (
    <button ref={buttonRef} type="button" onClick={share} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
};

export const ShareIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
  </svg>
);
