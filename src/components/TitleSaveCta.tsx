"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import {
  addToWatchlistById,
  removeFromWatchlistById,
} from "@/app/actions/watchlist";
import { cn } from "@/lib/cn";
import { membershipCopy, titleListMembership } from "@/lib/list-membership";
import { actionErrorMessage } from "@/lib/use-optimistic-action";
import { focusRing } from "@/lib/ui";

type AssignableList = {
  id: string;
  name: string;
  slug: string | null;
};

type TitleSaveCtaProps = {
  titleId: string;
  inWatchlist: boolean;
  memberLists: AssignableList[];
  listsPanel: ReactNode;
};

export const TitleSaveCta = ({
  titleId,
  inWatchlist,
  memberLists,
  listsPanel,
}: TitleSaveCtaProps) => {
  const [open, setOpen] = useState(false);
  const membership = titleListMembership(memberLists);
  const copy = membershipCopy(membership);
  const isInList = membership.state === "in-list";

  const handleToggleLists = () => {
    setOpen((current) => !current);
  };

  return (
    <div className="space-y-3">
      {isInList ? (
        <button
          type="button"
          onClick={handleToggleLists}
          aria-expanded={open}
          aria-haspopup="true"
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-2xl bg-accent px-5 py-3.5 text-left text-ink",
            focusRing,
          )}
        >
          <CheckIcon />
          <span className="min-w-0 flex-1 text-center">
            <span className="block font-semibold">En lista</span>
            <span className="block text-sm font-medium text-ink/80">
              {copy.detail}
            </span>
          </span>
          <ChevronIcon />
        </button>
      ) : (
        <WatchlistButton titleId={titleId} inWatchlist={inWatchlist} />
      )}

      {isInList ? (
        <p className="text-center text-sm text-accent">{copy.hint}</p>
      ) : null}

      {open && isInList ? listsPanel : null}
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimisticInWatchlist, applyWatchlist] = useOptimistic(inWatchlist);
  const copy = membershipCopy(
    optimisticInWatchlist ? { state: "watchlist" } : { state: "idle" },
  );

  const handleToggle = () => {
    const next = !optimisticInWatchlist;
    setError(null);
    startTransition(async () => {
      applyWatchlist(next);
      try {
        if (next) {
          await addToWatchlistById(titleId);
        } else {
          await removeFromWatchlistById(titleId);
        }
      } catch (caught) {
        setError(actionErrorMessage(caught));
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
          "flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-3.5 font-semibold",
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

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m6.5 12 3.5 3.5 7.5-7.5" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
  </svg>
);
