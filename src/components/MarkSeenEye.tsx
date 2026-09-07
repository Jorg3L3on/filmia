"use client";

import { useState, type MouseEvent, type PointerEvent } from "react";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type MarkSeenEyeProps = {
  titleId: string;
  titleName: string;
  rating?: number | null;
  review?: string | null;
  size?: "hero" | "queue";
  saveLabel?: string;
  onSaved?: () => void;
  onError?: (message: string) => void;
};

export const MarkSeenEye = ({
  titleId,
  titleName,
  rating = null,
  review = null,
  size = "hero",
  saveLabel,
  onSaved,
  onError,
}: MarkSeenEyeProps) => {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const isHero = size === "hero";

  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setOpen(true);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleSaved = () => {
    setHidden(true);
    onSaved?.();
  };

  const handleError = (message: string) => {
    setHidden(false);
    onError?.(message);
  };

  if (hidden) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Marqué visto: ${titleName}`}
        onClick={handleOpen}
        onPointerDown={handlePointerDown}
        className={cn(
          "absolute z-10 inline-flex items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] backdrop-blur-md hover:bg-black/70",
          focusRing,
          isHero ? "top-1.5 right-1.5 h-8 w-8" : "top-0.5 right-0.5 h-6 w-6",
        )}
      >
        <EyeIcon className={isHero ? "h-4 w-4" : "h-3.5 w-3.5"} />
      </button>
      <MarkWatchedSheet
        open={open}
        titleId={titleId}
        titleName={titleName}
        rating={rating}
        review={review}
        saveLabel={saveLabel}
        onClose={() => setOpen(false)}
        onSaved={handleSaved}
        onError={handleError}
      />
    </>
  );
};

const EyeIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.8 12s3.4-6.4 9.2-6.4S21.2 12 21.2 12s-3.4 6.4-9.2 6.4S2.8 12 2.8 12Z"
    />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);
