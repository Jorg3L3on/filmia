"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useOverlayLayer } from "@/components/useOverlayLayer";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Concrete verb on the destructive button («Eliminar lista», «Desconectar»). */
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  pendingLabel?: string;
  error?: string | null;
  cancelLabel?: string;
  /** Glyph in the header and on the destructive button. */
  glyph?: "trash" | "unlink";
};

const EXIT_FALLBACK_MS = 320;

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const TrashIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const UnlinkIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M9 12h6" />
    <path d="M8.5 8.5 6 6a4 4 0 0 0 0 5.7L8.5 14" />
    <path d="m15.5 15.5 2.5 2.5a4 4 0 0 0 0-5.7L15.5 10" />
  </svg>
);

/**
 * Centered crystal alert (dirección A). Irreversible deletes only: no timer.
 * Initial focus is Cancel. Sheets keep rising from the bottom; this one only fades.
 */
export const ConfirmDialog = ({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  pendingLabel,
  error = null,
  cancelLabel = "Cancelar",
  glyph = "trash",
}: ConfirmDialogProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => open,
  );
  const [rendered, setRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRendered(true);
    }
  }
  const closing = rendered && !open;

  useOverlayLayer({
    open,
    onClose: () => {
      if (!pending) {
        onClose();
      }
    },
    panelRef,
    initialFocusRef: cancelRef,
  });

  useEffect(() => {
    if (!closing) {
      return;
    }
    const timer = window.setTimeout(() => setRendered(false), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (
      closing &&
      event.target === event.currentTarget &&
      event.animationName === "confirm-fade-out"
    ) {
      setRendered(false);
    }
  };

  const handleClose = () => {
    if (pending) {
      return;
    }
    onClose();
  };

  if (!rendered || !mounted) {
    return null;
  }

  const renderGlyph = (className: string): ReactNode =>
    glyph === "unlink" ? <UnlinkIcon className={className} /> : <TrashIcon className={className} />;

  const node = (
    <div
      className={cn(
        "fixed inset-0 z-sheet-top flex items-center justify-center",
        "pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))]",
        "pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]",
        closing && "pointer-events-none",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-[rgb(5_6_7/0.55)]",
          closing ? "confirm-fade-out" : "confirm-fade-in",
        )}
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(
          "glass-panel glass-alert liquid-glass relative z-10 w-full max-w-[22.625rem] rounded-[28px] border p-4 outline-none",
          closing ? "confirm-fade-out" : "confirm-fade-in",
        )}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgb(255_107_122/0.20)] text-[#ff6b7a] shadow-[inset_0_0_0_1px_rgb(255_107_122/0.55)]"
          >
            {renderGlyph("size-4")}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-balance font-serif text-[16.5px] font-medium leading-[21px] text-paper">
              {title}
            </h2>
            <p id={descriptionId} className="mt-0.5 text-[13px] leading-[18px] text-[#c9cfd5]">
              {description}
            </p>
          </div>
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            data-initial-focus="true"
            onClick={handleClose}
            disabled={pending}
            className={cn(
              "inline-flex min-h-12 items-center justify-center rounded-[15px] border border-[#8b939c] bg-white/10 px-3 text-[14.5px] font-semibold text-paper",
              "disabled:opacity-60",
              focusRing,
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending || undefined}
            className={cn(
              "confirm-danger inline-flex min-h-12 items-center justify-center gap-2 rounded-[15px] px-3 text-[14.5px] font-semibold",
              "disabled:opacity-60",
              focusRing,
            )}
          >
            {renderGlyph("size-4")}
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return node;
  }

  return createPortal(node, document.body);
};
