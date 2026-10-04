"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { actionErrorMessage } from "@/lib/use-optimistic-action";

type DeleteCollectionButtonProps = {
  /** Bound server action; must not redirect — navigation happens client-side. */
  action: () => Promise<void>;
  redirectHref: string;
  label: string;
  name: string;
  impact: string;
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
        router.replace(redirectHref);
      } catch (caught) {
        setError(actionErrorMessage(caught));
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "press-scale group inline-flex h-11 items-center gap-2.5 rounded-full border border-danger-line bg-danger-well/50 pl-2 pr-5 text-sm font-medium text-danger transition-colors duration-[var(--duration-hover)] hover:border-danger/50 hover:bg-danger-well",
          focusRing,
        )}
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-danger/15 transition-colors duration-[var(--duration-hover)] group-hover:bg-danger/25">
          <TrashIcon className="size-4" />
        </span>
        {label}
      </button>

      <Sheet
        open={open}
        onClose={handleClose}
        labelledBy={headingId}
        overlayLabel="Cancelar"
        portal
        panelClassName="bg-surface"
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
            ¿Eliminar «{name}»?
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-fog">
            {impact} Tus películas y series no se borran.
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
            pendingLabel="Eliminando…"
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
            className="w-full rounded-full"
          >
            Cancelar
          </Button>
        </div>
      </Sheet>
    </>
  );
};
