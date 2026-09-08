"use client";

import { useState, type ReactNode } from "react";
import { setTitleRating } from "@/app/actions/titles";
import {
  addToWatchlistById,
  clearTitleWatched,
  markTitleWatched,
  removeFromWatchlistById,
} from "@/app/actions/watchlist";
import { RatingSheet } from "@/components/RatingSheet";
import { cn } from "@/lib/cn";
import { formatStarScore } from "@/lib/labels";
import { useSpringFeedback } from "@/lib/motion";
import { showToast } from "@/lib/toast";
import { useStickyOptimistic } from "@/lib/use-optimistic-action";
import { focusRing } from "@/lib/ui";

type TitleActionRowProps = {
  titleId: string;
  watched: boolean;
  inWatchlist: boolean;
  inCustomList?: boolean;
  rating: number | null;
  review?: string | null;
  listsPanel: ReactNode;
  tagsPanel: ReactNode;
};

type Panel = "lists" | "tags" | null;

type ActionState = {
  watched: boolean;
  inWatchlist: boolean;
  rating: number | null;
  review: string | null;
};

const sameActionState = (left: ActionState, right: ActionState) =>
  left.watched === right.watched &&
  left.inWatchlist === right.inWatchlist &&
  left.rating === right.rating &&
  left.review === right.review;

export const TitleActionRow = ({
  titleId,
  watched,
  inWatchlist,
  inCustomList = false,
  rating,
  review = null,
  listsPanel,
  tagsPanel,
}: TitleActionRowProps) => {
  const [panel, setPanel] = useState<Panel>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"watched" | "watchlist" | "rating" | null>(
    null,
  );
  const {
    value: optimistic,
    error,
    isPending,
    run,
  } = useStickyOptimistic(
    { watched, inWatchlist, rating, review },
    sameActionState,
  );
  const watchedSpring = useSpringFeedback();
  const watchlistSpring = useSpringFeedback();
  const ratingSpring = useSpringFeedback();

  const handleToggleWatched = () => {
    const nextWatched = !optimistic.watched;
    setPendingAction("watched");
    watchedSpring.trigger();
    showToast({
      title: nextWatched ? "Marcada como vista" : "Quitada del diario",
    });
    run(
      {
        ...optimistic,
        watched: nextWatched,
        inWatchlist: nextWatched ? false : optimistic.inWatchlist,
      },
      async () => {
        try {
          if (nextWatched) {
            await markTitleWatched(titleId);
          } else {
            await clearTitleWatched(titleId);
          }
        } finally {
          setPendingAction(null);
        }
      },
    );
  };

  const handleToggleWatchlist = () => {
    const nextInWatchlist = !optimistic.inWatchlist;
    setPendingAction("watchlist");
    watchlistSpring.trigger();
    showToast({
      title: nextInWatchlist ? "En Quiero ver" : "Fuera de Quiero ver",
    });
    run(
      { ...optimistic, inWatchlist: nextInWatchlist },
      async () => {
        try {
          if (nextInWatchlist) {
            await addToWatchlistById(titleId);
          } else {
            await removeFromWatchlistById(titleId);
          }
        } finally {
          setPendingAction(null);
        }
      },
    );
  };

  const handleSaveRating = (next: { rating: number | null; review: string }) => {
    setPendingAction("rating");
    setRatingOpen(false);
    showToast({ title: "Nota guardada" });
    run(
      {
        ...optimistic,
        rating: next.rating,
        review: next.review || null,
      },
      async () => {
        try {
          const formData = new FormData();
          if (next.rating != null) {
            formData.set("rating", String(next.rating));
          }
          formData.set("review", next.review);
          await setTitleRating(titleId, formData);
        } finally {
          setPendingAction(null);
        }
      },
    );
  };

  const handleTogglePanel = (next: Panel) => {
    setPanel((current) => (current === next ? null : next));
  };

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Acciones del título"
        className="grid grid-cols-5 gap-2"
      >
        <button
          type="button"
          onClick={handleToggleWatched}
          disabled={pendingAction === "watched"}
          aria-pressed={optimistic.watched}
          aria-label={optimistic.watched ? "Quitar de visto" : "Marcar como visto"}
          className={cn(
            "spring-fill flex w-full flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[10px] uppercase tracking-[0.12em]",
            focusRing,
            watchedSpring.className,
            optimistic.watched
              ? "border-success/40 bg-success-well text-success"
              : "border-chrome bg-well text-fog hover:text-paper",
            pendingAction === "watched" && "opacity-80",
          )}
        >
          <WatchedIcon filled={optimistic.watched} />
          Visto
        </button>

        <button
          type="button"
          onClick={handleToggleWatchlist}
          disabled={pendingAction === "watchlist"}
          aria-pressed={optimistic.inWatchlist}
          aria-label={
            optimistic.inWatchlist ? "Quitar de Quiero ver" : "Añadir a Quiero ver"
          }
          className={cn(
            "spring-fill flex w-full flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[10px] uppercase tracking-[0.12em]",
            focusRing,
            watchlistSpring.className,
            optimistic.inWatchlist
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-chrome bg-well text-fog hover:text-paper",
            pendingAction === "watchlist" && "opacity-80",
          )}
        >
          <WatchlistIcon filled={optimistic.inWatchlist} />
          Quiero ver
        </button>

        <button
          type="button"
          onClick={() => {
            ratingSpring.trigger();
            setRatingOpen(true);
          }}
          aria-expanded={ratingOpen}
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[10px] uppercase tracking-[0.12em]",
            focusRing,
            ratingSpring.className,
            optimistic.rating != null
              ? "border-star/40 bg-well text-star"
              : "border-chrome bg-well text-fog hover:text-paper",
          )}
        >
          <StarIcon filled={optimistic.rating != null} />
          {optimistic.rating != null ? formatStarScore(optimistic.rating) : "Nota"}
        </button>

        <button
          type="button"
          onClick={() => handleTogglePanel("lists")}
          aria-expanded={panel === "lists"}
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[10px] uppercase tracking-[0.12em]",
            focusRing,
            inCustomList || panel === "lists"
              ? "border-accent bg-accent/10 text-accent"
              : "border-chrome bg-well text-fog hover:text-paper",
          )}
        >
          <PlusListIcon />
          {inCustomList ? "En lista" : "Lista"}
        </button>

        <button
          type="button"
          onClick={() => handleTogglePanel("tags")}
          aria-expanded={panel === "tags"}
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-2xl border border-chrome bg-well px-1 py-2.5 text-[10px] uppercase tracking-[0.12em] text-fog hover:text-paper",
            focusRing,
            panel === "tags" && "border-accent text-accent",
          )}
        >
          <TagIcon />
          Etiquetas
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <RatingSheet
        open={ratingOpen}
        titleId={titleId}
        rating={optimistic.rating}
        review={optimistic.review}
        pending={isPending && pendingAction === "rating"}
        onClose={() => setRatingOpen(false)}
        onSave={handleSaveRating}
      />

      {panel === "lists" ? listsPanel : null}

      {panel === "tags" ? tagsPanel : null}
    </div>
  );
};

const WatchedIcon = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    aria-hidden="true"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.75}
  >
    <circle cx="12" cy="12" r="8.25" />
    <path
      fill={filled ? "var(--ink)" : "none"}
      stroke={filled ? "var(--ink)" : "currentColor"}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m8.5 12.2 2.3 2.3 4.7-5"
    />
  </svg>
);

const WatchlistIcon = ({ filled }: { filled: boolean }) => (
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

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    aria-hidden="true"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.75}
  >
    <path
      strokeLinejoin="round"
      d="m12 4.5 2.1 4.4 4.8.6-3.5 3.3.9 4.8L12 15.4 7.7 17.6l.9-4.8-3.5-3.3 4.8-.6Z"
    />
  </svg>
);

const PlusListIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
  >
    <path strokeLinecap="round" d="M6 8h12M6 12h12M6 16h7M16.5 15.5v5M14 18h5" />
  </svg>
);

const TagIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
  >
    <path
      strokeLinejoin="round"
      d="M4.5 12.5 12 5h6.5V11.5L11.5 18.5 4.5 12.5Z"
    />
    <circle cx="16" cy="8" r="1" fill="currentColor" />
  </svg>
);
