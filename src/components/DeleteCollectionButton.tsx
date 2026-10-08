"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import { focusRing } from "@/lib/ui";
import { actionErrorMessage } from "@/lib/use-optimistic-action";

type DeleteCollectionButtonProps = {
  /**
   * Bound server action. Navigation to `redirectHref` happens client-side; an action that
   * calls `redirect()` instead is also treated as done (Next navigates in the same roundtrip).
   */
  action: () => Promise<void>;
  redirectHref: string;
  label: string;
  name: string;
  impact: string;
  /** Sheet heading. Defaults to «¿Eliminar «name»?». */
  heading?: string;
  /** Reassurance after `impact`. Defaults to the list copy. */
  note?: string;
  pendingLabel?: string;
  /** Toast shown once the action succeeds. */
  successToast?: string;
};

/** True for Next's control-flow errors (e.g. a server action's `redirect()`). */
const isNextNavigation = (error: unknown) => {
  try {
    unstable_rethrow(error);
    return false;
  } catch {
    return true;
  }
};

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export const DeleteCollectionButton = ({
  action,
  redirectHref,
  label,
  name,
  impact,
  heading,
  note = "Tus películas y series no se borran.",
  pendingLabel = "Eliminando…",
  successToast,
}: DeleteCollectionButtonProps) => {
  const router = useRouter();
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setError(null);
    setOpen(true);
  };

  const handleClose = useCallback(() => {
    if (isPending) return;
    setOpen(false);
  }, [isPending]);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        if (!isNextNavigation(caught)) {
          setError(actionErrorMessage(caught));
          return;
        }
        // The action redirected server-side; the router is already navigating.
        if (successToast) showToast({ title: successToast });
        return;
      }
      if (successToast) showToast({ title: successToast });
      router.replace(redirectHref);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "press-scale group inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-fog transition-colors duration-[var(--duration-hover)] hover:text-danger",
          focusRing,
        )}
      >
        <TrashIcon className="size-4" />
        {label}
      </button>

      <Sheet
        open={open}
        onClose={handleClose}
        labelledBy={headingId}
        overlayLabel="Cancelar"
        portal
      >
        <div className="flex flex-col items-center px-6 pb-2 pt-3 text-center">
          <SheetHandle className="sm:hidden" />
          <span
            aria-hidden="true"
            className="mt-3 inline-flex size-14 items-center justify-center rounded-full border border-danger-line bg-danger-well text-danger shadow-[0_0_32px_rgba(255,107,122,0.18)]"
          >
            <TrashIcon className="size-6" />
          </span>
          <h2 id={headingId} className="mt-4 text-balance font-serif text-2xl leading-tight text-paper">
            {heading ?? `¿Eliminar «${name}»?`}
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-fog">
            {impact} {note}
          </p>
          {error ? (
            <p
              role="alert"
              className="mt-4 w-full rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 px-6 pb-2 pt-4" data-no-sheet-drag>
          <Button
            type="button"
            variant="danger"
            size="lg"
            onClick={handleConfirm}
            pending={isPending}
            pendingLabel={pendingLabel}
            className="press-scale w-full rounded-full"
          >
            {label}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleClose}
            disabled={isPending}
            autoFocus
            className="w-full rounded-full"
          >
            Cancelar
          </Button>
        </div>
      </Sheet>
    </>
  );
};
