"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { pinTonightFromFicha } from "@/app/actions/tonight";
import { setTitleRating } from "@/app/actions/titles";
import {
  addToWatchlistById,
  clearTitleWatched,
  removeFromWatchlistById,
} from "@/app/actions/watchlist";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { RatingSheet } from "@/components/RatingSheet";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { formatStarScore } from "@/lib/labels";
import { useSpringFeedback } from "@/lib/motion";
import { showToast } from "@/lib/toast";
import { PARA_TI_SLUG } from "@/lib/tonight/select";
import { TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
import { focusRing } from "@/lib/ui";
import { useStickyOptimistic } from "@/lib/use-optimistic-action";

const HOY_PARA_TI_HREF = `/?${TONIGHT_LENS_PARAM}=${PARA_TI_SLUG}`;

type TitleFichaActionsProps = {
  titleId: string;
  titleName: string;
  watched: boolean;
  inWatchlist: boolean;
  /** Saved lists (Quiero ver excluded). */
  listCount: number;
  rating: number | null;
  review: string | null;
  /** Saved «Dónde la vi»; prefills the Marqué visto sheet. */
  platform: Platform | null;
  /** This title is tonight's pin right now. */
  pinnedTonight: boolean;
  listsPanel: ReactNode;
};

type ActionState = {
  watched: boolean;
  inWatchlist: boolean;
  rating: number | null;
  review: string | null;
  pinned: boolean;
};

const sameActionState = (left: ActionState, right: ActionState) =>
  left.watched === right.watched &&
  left.inWatchlist === right.inWatchlist &&
  left.rating === right.rating &&
  left.review === right.review &&
  left.pinned === right.pinned;

const groupItemClass = (active: boolean) =>
  cn(
    "ficha-action press-scale flex min-h-[3.625rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-[color,background-color,opacity] duration-[var(--duration-hover)] ease-[var(--ease-out)] sm:min-h-11 sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-[13px]",
    focusRing,
    active ? undefined : "text-paper/80 hover:bg-white/[0.06] hover:text-paper",
  );

/**
 * Ficha actions, dirección A: «Ver esta noche» is the one primary (the moon of
 * FIL-I3-4; it adds to Quiero ver when needed and pins), then one glass group
 * with Quiero ver · Vi esto · Nota · Lista and their sheets. Hidden «Ver esta
 * noche» once the title is watched.
 */
export const TitleFichaActions = ({
  titleId,
  titleName,
  watched,
  inWatchlist,
  listCount,
  rating,
  review,
  platform,
  pinnedTonight,
  listsPanel,
}: TitleFichaActionsProps) => {
  const router = useRouter();
  const listsPanelId = useId();
  const [listsOpen, setListsOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [seenOpen, setSeenOpen] = useState(false);
  const [seenOptimistic, setSeenOptimistic] = useState(false);
  const [justPinned, setJustPinned] = useState(false);
  const [isPinning, setPinning] = useState(false);
  const [pendingAction, setPendingAction] = useState<"watched" | "rating" | "watchlist" | null>(null);
  const { value: state, error, run } = useStickyOptimistic(
    { watched, inWatchlist, rating, review, pinned: pinnedTonight },
    sameActionState,
  );
  const watchedSpring = useSpringFeedback();
  const ratingSpring = useSpringFeedback();
  const watchlistSpring = useSpringFeedback();

  const displayedWatched = state.watched || seenOptimistic;

  const handlePin = () => {
    if (state.pinned || isPinning) {
      return;
    }
    setPinning(true);
    setJustPinned(true);
    run({ ...state, pinned: true, inWatchlist: true }, async () => {
      try {
        const result = await pinTonightFromFicha(titleId);
        if (!result.ok) {
          throw new Error(result.error);
        }
        showToast({
          title: "Sale primero en Hoy",
          description: result.addedToWatchlist ? `${titleName} · también en Quiero ver` : titleName,
          action: { label: "Ver en Hoy", onClick: () => router.push(HOY_PARA_TI_HREF) },
        });
      } finally {
        setPinning(false);
      }
    });
  };

  const handleToggleWatchlist = () => {
    const next = !state.inWatchlist;
    setPendingAction("watchlist");
    watchlistSpring.trigger();
    showToast({ title: next ? "En Quiero ver" : "Fuera de Quiero ver" });
    run({ ...state, inWatchlist: next }, async () => {
      try {
        if (next) {
          await addToWatchlistById(titleId);
        } else {
          await removeFromWatchlistById(titleId);
        }
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleToggleWatched = () => {
    if (!displayedWatched) {
      setSeenOpen(true);
      return;
    }
    setSeenOptimistic(false);
    setPendingAction("watched");
    watchedSpring.trigger();
    showToast({ title: "Quitada del diario" });
    run({ ...state, watched: false }, async () => {
      try {
        await clearTitleWatched(titleId);
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleSaveRating = (next: { rating: number | null; review: string }) => {
    setPendingAction("rating");
    setRatingOpen(false);
    showToast({ title: "Nota guardada" });
    run({ ...state, rating: next.rating, review: next.review || null }, async () => {
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
    });
  };

  return (
    <div
      className="ficha-actions-a ficha-enter space-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:space-y-0"
      style={{ "--i": 5 } as CSSProperties}
    >
      {displayedWatched ? null : state.pinned ? (
        <Link
          href={HOY_PARA_TI_HREF}
          aria-label="Fijada para esta noche. Ver en Hoy"
          className={cn(
            "ficha-tonight is-done liquid-glass liquid-glass-pill liquid-glass-pill-aura press-scale relative flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold text-paper sm:w-auto sm:px-7",
            focusRing,
          )}
        >
          <span key="full" className={cn("inline-flex text-accent", justPinned && "spring-pop")}>
            <MoonIcon filled />
          </span>
          <span className="whitespace-nowrap">Fijada para esta noche</span>
          {/* The whole bar opens Hoy; the hint only where it fits on one line. */}
          <span className="whitespace-nowrap text-accent max-[359px]:hidden">· Ver en Hoy</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={handlePin}
          disabled={isPinning}
          aria-busy={isPinning || undefined}
          className={cn(
            "ficha-tonight tonight-pin press-scale relative flex h-[3.25rem] w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-accent px-5 text-base font-semibold text-ink disabled:opacity-70 sm:w-auto sm:px-7",
            focusRing,
          )}
        >
          <MoonIcon filled={false} />
          {isPinning ? "Reservando…" : "Ver esta noche"}
        </button>
      )}

      <div role="group" aria-label="Acciones del título" className="ficha-action-group grid grid-cols-4 gap-1 p-1.5 sm:flex sm:gap-0.5 sm:rounded-full sm:p-1">
        <button
          type="button"
          onClick={handleToggleWatchlist}
          disabled={pendingAction === "watchlist"}
          aria-pressed={state.inWatchlist}
          className={cn(
            groupItemClass(state.inWatchlist),
            watchlistSpring.className,
            state.inWatchlist && "bg-accent/14 text-accent-hover",
          )}
        >
          <BookmarkIcon filled={state.inWatchlist} />
          <span>
            {state.inWatchlist ? <span className="max-[359px]:hidden">En </span> : null}
            Quiero ver
          </span>
        </button>

        <button
          type="button"
          onClick={handleToggleWatched}
          disabled={pendingAction === "watched"}
          aria-pressed={displayedWatched}
          aria-label={displayedWatched ? "Quitar de visto" : "Marcar como visto"}
          className={cn(
            groupItemClass(displayedWatched),
            "spring-fill",
            watchedSpring.className,
            displayedWatched && "bg-success/12 text-success",
          )}
        >
          {displayedWatched ? <CheckIcon /> : <EyeIcon />}
          {displayedWatched ? "Vista" : "Vi esto"}
        </button>

        <button
          type="button"
          onClick={() => {
            ratingSpring.trigger();
            setRatingOpen(true);
          }}
          aria-expanded={ratingOpen}
          className={cn(groupItemClass(state.rating != null), ratingSpring.className, state.rating != null && "text-star")}
        >
          <StarIcon filled={state.rating != null} />
          {state.rating != null ? formatStarScore(state.rating) : "Nota"}
        </button>

        <button
          type="button"
          onClick={() => setListsOpen((current) => !current)}
          aria-expanded={listsOpen}
          aria-controls={listsPanelId}
          className={cn(groupItemClass(listsOpen), listsOpen && "bg-accent/14 text-accent-hover")}
        >
          <ListIcon />
          {listCount > 0 ? `En ${listCount} ${listCount === 1 ? "lista" : "listas"}` : "Lista"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-center text-sm text-danger sm:basis-full sm:text-left">
          {error}
        </p>
      ) : null}

      {listsOpen ? (
        <div id={listsPanelId} className="sm:basis-full">
          {listsPanel}
        </div>
      ) : null}

      <MarkWatchedSheet
        open={seenOpen}
        titleId={titleId}
        titleName={titleName}
        rating={state.rating}
        review={state.review}
        platform={platform}
        onClose={() => setSeenOpen(false)}
        onSaved={() => {
          setSeenOptimistic(true);
          watchedSpring.trigger();
        }}
        onError={() => setSeenOptimistic(false)}
      />

      <RatingSheet
        open={ratingOpen}
        titleId={titleId}
        rating={state.rating}
        review={state.review}
        pending={pendingAction === "rating"}
        onClose={() => setRatingOpen(false)}
        onSave={handleSaveRating}
      />
    </div>
  );
};

/** Same crescent as Hoy's «Hasta las 23:00» chip and Buscar's sheet; filled once pinned. */
const MoonIcon = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className="size-[1.15rem] shrink-0"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);

const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="size-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.3 2.4 2.4 4.6-5" />
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="size-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinejoin="round" d="m12 4.5 2.1 4.4 4.8.6-3.5 3.3.9 4.8L12 15.4 7.7 17.6l.9-4.8-3.5-3.3 4.8-.6Z" />
  </svg>
);

const ListIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" d="M6 8h12M6 12h12M6 16h7M16.5 15.5v5M14 18h5" />
  </svg>
);
