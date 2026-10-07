"use client";

import { useState, type ReactNode } from "react";
import {
  addToWatchlistById,
  removeFromWatchlistById,
} from "@/app/actions/watchlist";
import { cn } from "@/lib/cn";
import {
  membershipCopy,
  membershipStatusCopy,
  titleListMemberships,
} from "@/lib/list-membership";
import { showToast } from "@/lib/toast";
import { useStickyOptimistic } from "@/lib/use-optimistic-action";
import { focusRing } from "@/lib/ui";

type AssignableList = {
  id: string;
  name: string;
  slug: string | null;
};

/**
 * Primary ficha save control. Quiero ver lives here only — the chip row
 * does not duplicate it. Optimistic toggle uses `useStickyOptimistic`.
 *
 * List membership is a status line («Guardada en …» / «En N listas»), never
 * a filled button: the only action next to it is the idle «Gestionar listas».
 * Pass `listsOpen` + `onToggleLists` to share one panel with the chip row;
 * without them the CTA keeps its own state and renders `listsPanel` itself.
 */
type TitleSaveCtaProps = {
  titleId: string;
  inWatchlist: boolean;
  memberLists: AssignableList[];
  listsPanel?: ReactNode;
  listsOpen?: boolean;
  onToggleLists?: () => void;
  listsPanelId?: string;
};

export const TitleSaveCta = ({
  titleId,
  inWatchlist,
  memberLists,
  listsPanel = null,
  listsOpen,
  onToggleLists,
  listsPanelId,
}: TitleSaveCtaProps) => {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = onToggleLists != null;
  const open = controlled ? Boolean(listsOpen) : ownOpen;
  const status = membershipStatusCopy(titleListMemberships(memberLists).lists);

  const handleToggleLists = () => {
    if (controlled) {
      onToggleLists();
      return;
    }
    setOwnOpen((current) => !current);
  };

  return (
    <div className="space-y-3">
      <WatchlistButton titleId={titleId} inWatchlist={inWatchlist} />

      {status ? (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <SavedIcon />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-paper">{status.label}</p>
            {status.detail ? (
              <p className="text-xs leading-5 text-mist">{status.detail}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleToggleLists}
            aria-expanded={open}
            aria-controls={listsPanelId}
            className={cn(
              "press-scale shrink-0 rounded-full border border-chrome px-3 py-1.5 text-xs font-medium text-fog transition-[transform,color,border-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-line-hover hover:text-paper",
              focusRing,
            )}
          >
            Gestionar listas
          </button>
        </div>
      ) : null}

      {!controlled && open ? listsPanel : null}
    </div>
  );
};

const WatchlistButton = ({
  titleId,
  inWatchlist,
}: {
  titleId: string;
  inWatchlist: boolean;
}) => {
  const {
    value: optimisticInWatchlist,
    error,
    isPending,
    run,
  } = useStickyOptimistic(inWatchlist);
  const copy = membershipCopy(
    optimisticInWatchlist ? { state: "watchlist" } : { state: "idle" },
  );

  const handleToggle = () => {
    const next = !optimisticInWatchlist;
    showToast({
      title: next ? "En Quiero ver" : "Fuera de Quiero ver",
    });
    run(next, async () => {
      if (next) {
        await addToWatchlistById(titleId);
      } else {
        await removeFromWatchlistById(titleId);
      }
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={optimisticInWatchlist}
        className={cn(
          "press-scale flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-3.5 font-semibold transition-[transform,background-color,color,border-color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
          focusRing,
          optimisticInWatchlist
            ? "bg-accent text-ink"
            : "border border-paper/70 bg-transparent font-medium text-paper",
        )}
      >
        <BookmarkIcon filled={optimisticInWatchlist} />
        {copy.label}
      </button>
      <p
        className={cn(
          "text-center text-sm",
          optimisticInWatchlist ? "text-accent" : "text-mist",
        )}
      >
        {copy.hint}
      </p>
      {error ? (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};

const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    aria-hidden="true"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.75}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z"
    />
  </svg>
);

/** Stacked-lists glyph in muted ink: reads as «saved», not as a pressed control. */
const SavedIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 shrink-0 text-mist"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <path strokeLinecap="round" d="M6 8h12M6 12h12M6 16h6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 16.5 1.75 1.75L19.5 15" />
  </svg>
);
