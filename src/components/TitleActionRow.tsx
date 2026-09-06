"use client";

import { useState, type ReactNode } from "react";
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
  const watchedSpring = useSpringFeedback();
  const watchlistSpring = useSpringFeedback();
  const ratingSpring = useSpringFeedback();
  const markWatched = markTitleWatched.bind(null, titleId);
  const unwatch = clearTitleWatched.bind(null, titleId);
  const addWatchlist = addToWatchlistById.bind(null, titleId);
  const removeWatchlist = removeFromWatchlistById.bind(null, titleId);

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
        <form action={watched ? unwatch : markWatched}>
          <button
            type="submit"
            onClick={watchedSpring.trigger}
            aria-pressed={watched}
            className={cn(
              "spring-fill flex w-full flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[10px] uppercase tracking-[0.12em]",
              focusRing,
              watchedSpring.className,
              watched
                ? "border-success/40 bg-success-well text-success"
                : "border-chrome bg-well text-fog hover:text-paper",
            )}
          >
            <WatchedIcon filled={watched} />
            Visto
          </button>
        </form>

        <form action={inWatchlist ? removeWatchlist : addWatchlist}>
          <button
            type="submit"
            onClick={watchlistSpring.trigger}
            aria-pressed={inWatchlist}
            className={cn(
              "spring-fill flex w-full flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[10px] uppercase tracking-[0.12em]",
              focusRing,
              watchlistSpring.className,
              inWatchlist
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-chrome bg-well text-fog hover:text-paper",
            )}
          >
            <WatchlistIcon filled={inWatchlist} />
            Quiero ver
          </button>
        </form>

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
            rating != null
              ? "border-star/40 bg-well text-star"
              : "border-chrome bg-well text-fog hover:text-paper",
          )}
        >
          <StarIcon filled={rating != null} />
          {rating != null ? formatStarScore(rating) : "Nota"}
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

      <RatingSheet
        open={ratingOpen}
        titleId={titleId}
        rating={rating}
        review={review}
        onClose={() => setRatingOpen(false)}
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
