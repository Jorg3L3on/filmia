"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  isBlockingToast,
  isUndoToast,
  pauseToast,
  resumeToast,
  shouldDismissSwipe,
  type ToastItem,
  type ToastVariant,
} from "@/lib/toast";

type ToastCardProps = {
  toast: ToastItem;
  phase?: "in" | "out";
  onDismiss?: () => void;
  /** Static previews stay out of the live region and must not raise `role="alert"`. */
  announce?: boolean;
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Glyph = ({ variant }: { variant: ToastVariant }) => (
  <svg className="toast-glyph" viewBox="0 0 24 24" aria-hidden="true">
    {variant === "success" ? <path d="M5 12.5 9.5 17 19 7.5" /> : null}
    {variant === "info" ? (
      <>
        <path d="M12 11v6" />
        <path d="M12 7.5h.01" />
      </>
    ) : null}
    {variant === "progress" ? (
      <>
        <path d="M12 4v11" />
        <path d="m7 11 5 5 5-5" />
        <path d="M5 20h14" />
      </>
    ) : null}
    {variant === "warning" ? (
      <>
        <path d="M12 4.2 21.2 20H2.8L12 4.2Z" />
        <path d="M12 10v4.5" />
        <path d="M12 17.2h.01" />
      </>
    ) : null}
    {variant === "error" ? (
      <>
        <path d="M12 8v5" />
        <path d="M12 16.5h.01" />
      </>
    ) : null}
  </svg>
);

const UndoGlyph = () => (
  <svg className="toast-glyph toast-glyph-sm" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

const ToastLight = ({ toast }: { toast: ToastItem }) => {
  const barRef = useRef<HTMLSpanElement>(null);
  const { durationMs, remainingMs, deadline, held } = toast;

  useEffect(() => {
    const node = barRef.current;
    if (!node || durationMs == null || remainingMs == null) {
      return;
    }
    let frame = 0;
    const draw = () => {
      const left = held || deadline == null ? remainingMs : Math.max(0, deadline - Date.now());
      const ratio = Math.min(1, Math.max(0, left / durationMs));
      node.style.transform = `scaleX(${ratio})`;
      if (!held && deadline != null) {
        frame = window.requestAnimationFrame(draw);
      }
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [deadline, durationMs, held, remainingMs]);

  return (
    <span className="toast-light" aria-hidden="true">
      <span ref={barRef} />
    </span>
  );
};

export const ToastCard = ({ toast, phase = "in", onDismiss, announce = true }: ToastCardProps) => {
  const cardRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    t: number;
    pointer: number;
    captured: boolean;
  } | null>(null);
  const ignoreClickRef = useRef(false);
  const blocking = isBlockingToast(toast);
  const undo = isUndoToast(toast);
  const persistentClose = toast.variant === "error" || toast.durationMs == null;
  const live = phase === "in";

  const setShift = (dx: number, spring: boolean) => {
    const node = cardRef.current;
    if (!node || reducedMotion()) {
      return;
    }
    node.style.transition = spring ? "transform 280ms var(--spring)" : "none";
    node.style.transform = dx === 0 ? "" : `translate3d(${dx}px, 0, 0)`;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!live || event.button !== 0) {
      return;
    }
    // A button's click must land on the button. Capturing on pointerdown retargets it to the article.
    const target = event.target;
    if (target instanceof Element && target.closest("button")) {
      return;
    }
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      pointer: event.pointerId,
      captured: false,
    };
    pauseToast(toast.id, "press");
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.captured) {
      if (Math.abs(dx) <= 8 || Math.abs(dy) > Math.abs(dx)) {
        return;
      }
      drag.captured = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setShift(dx, false);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resumeToast(toast.id, "press");
    const dx = event.clientX - drag.x;
    const elapsed = event.timeStamp - drag.t;
    if (Math.abs(dx) > 8) {
      ignoreClickRef.current = true;
    }
    if (shouldDismissSwipe(dx, elapsed)) {
      setShift(0, false);
      onDismiss?.();
      return;
    }
    setShift(0, true);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointer !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resumeToast(toast.id, "press");
    setShift(0, true);
  };

  const handleClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!ignoreClickRef.current) {
      return;
    }
    ignoreClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  const actionButton = toast.action ? (
    <button
      type="button"
      className={cn("toast-action", focusRing)}
      onClick={() => {
        toast.action?.onClick();
        handleDismiss();
      }}
    >
      {undo ? <UndoGlyph /> : null}
      {toast.action.label}
    </button>
  ) : null;

  return (
    <article
      ref={cardRef}
      data-variant={toast.variant}
      data-toast-id={toast.id}
      role={announce && blocking && live ? "alert" : undefined}
      aria-hidden={live ? undefined : true}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={handleClickCapture}
      onPointerEnter={live ? () => pauseToast(toast.id, "hover") : undefined}
      onPointerLeave={live ? () => resumeToast(toast.id, "hover") : undefined}
      onFocus={live ? () => pauseToast(toast.id, "focus") : undefined}
      onBlur={
        live
          ? (event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) {
                return;
              }
              resumeToast(toast.id, "focus");
            }
          : undefined
      }
      className={cn("toast", undo && "toast-undo", phase === "out" ? "toast-out" : "toast-in")}
    >
      <span className="toast-lead">
        {toast.poster ? (
          <span className="toast-poster">
            {/* Decorative: the title names the film. Any URL, so not next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toast.poster} alt="" width={40} height={60} />
            <span className="toast-badge">
              <Glyph variant={toast.variant} />
            </span>
          </span>
        ) : (
          <span className={cn("toast-icon", toast.variant === "progress" && "toast-icon-spin")}>
            {toast.variant === "progress" ? (
              <svg className="toast-spin" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="14" />
              </svg>
            ) : null}
            <Glyph variant={toast.variant} />
          </span>
        )}
      </span>
      <div className="toast-body">
        <div className="toast-copy">
          <p className="toast-title">{toast.title}</p>
          {toast.description ? (
            <p className={cn("toast-sub", toast.variant === "error" && "toast-sub-two")}>{toast.description}</p>
          ) : null}
          {toast.variant === "progress" ? (
            <span className="toast-progress" aria-hidden="true">
              <i style={{ width: `${Math.round((toast.progress ?? 0) * 100)}%` }} />
            </span>
          ) : null}
        </div>
        {toast.choices ? (
          <div className="toast-row">
            <div className="toast-choices" role="group" aria-label="¿Qué te pareció?">
              {toast.choices.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  className={cn("toast-choice", focusRing)}
                  onClick={() => choice.onChoose()}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            {actionButton}
          </div>
        ) : (
          actionButton
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={handleDismiss}
        className={cn("toast-x", focusRing, !persistentClose && "toast-x-hover")}
      >
        <span aria-hidden="true">×</span>
      </button>
      {toast.count > 1 ? (
        <span className="toast-count" aria-hidden="true">
          {toast.count}
        </span>
      ) : null}
      {undo ? <ToastLight toast={toast} /> : null}
    </article>
  );
};
