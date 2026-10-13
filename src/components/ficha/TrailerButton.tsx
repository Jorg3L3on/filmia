"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { isRemoteImage } from "@/lib/tmdb";
import { trailerEmbedUrl } from "@/lib/tmdb-trailer";
import { focusRing } from "@/lib/ui";

type TrailerButtonProps = {
  trailerKey: string;
  titleName: string;
  backdropSrc: string | null;
};

/**
 * «▶ Tráiler» (FIL-I15-2): a black, full-screen modal <dialog> with a 16:9
 * youtube-nocookie embed. The iframe only exists while the dialog is open, so
 * nothing loads or plays inline in the ficha and closing stops the video. The
 * backdrop holds the frame until the player has loaded.
 */
export const TrailerButton = ({ trailerKey, titleName, backdropSrc }: TrailerButtonProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) {
      return;
    }
    const trigger = triggerRef.current;
    dialog.showModal();
    // Focus «Cerrar», not the player: keys never leave YouTube's iframe, so Escape would stop working.
    closeRef.current?.focus();
    // iOS keeps scrolling the page behind a modal dialog unless <html> is locked too.
    const { documentElement: html, body } = document;
    const saved = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = saved.html;
      body.style.overflow = saved.body;
      if (dialog.open) {
        dialog.close();
      }
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setLoaded(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "liquid-glass liquid-glass-pill relative inline-flex h-7 items-center gap-1.5 rounded-full pl-2 pr-2.5 text-xs font-semibold text-paper transition-transform active:scale-[0.97]",
          focusRing,
        )}
      >
        <PlayGlyph />
        Tráiler
      </button>

      <dialog
        ref={dialogRef}
        aria-label={`Tráiler de ${titleName}`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          // A tap on the black around the player closes it, like the button.
          if (event.target === event.currentTarget) {
            close();
          }
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center bg-black p-0 text-paper backdrop:bg-black open:flex"
      >
        {open ? (
          <div className="relative aspect-video w-full max-w-[calc(100dvh*16/9)]">
            {backdropSrc ? (
              <Image
                src={backdropSrc}
                alt=""
                fill
                sizes="100vw"
                aria-hidden="true"
                className={cn(
                  "object-cover transition-opacity duration-500",
                  loaded ? "opacity-0" : "opacity-60",
                )}
                unoptimized={isRemoteImage(backdropSrc)}
              />
            ) : null}
            {!loaded ? (
              <span
                className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/25 border-t-white"
                aria-hidden="true"
              />
            ) : null}
            <iframe
              src={trailerEmbedUrl(trailerKey)}
              title={`Tráiler de ${titleName}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoaded(true)}
              className={cn(
                "absolute inset-0 size-full border-0 transition-opacity duration-500",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={close}
          ref={closeRef}
          aria-label="Cerrar tráiler"
          className={cn(
            "absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] inline-flex size-11 items-center justify-center rounded-full bg-white/12 text-paper backdrop-blur transition hover:bg-white/20",
            focusRing,
          )}
        >
          <CloseGlyph />
        </button>
      </dialog>
    </>
  );
};

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </svg>
);

const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
