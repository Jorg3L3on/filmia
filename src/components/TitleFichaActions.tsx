"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { saveTmdbTitleInLists } from "@/app/actions/lists";
import { markTmdbTitleWatched, rateTmdbTitle } from "@/app/actions/title-preview";
import { pinTonightFromFicha, pinTonightFromSearch } from "@/app/actions/tonight";
import { addTitleFromTmdb, setTitleRating } from "@/app/actions/titles";
import {
  addToWatchlistById,
  clearTitleWatched,
  markTitleWatched,
  removeFromWatchlistById,
  restoreTitleWatched,
} from "@/app/actions/watchlist";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { retargetCurrentNav } from "@/components/NavOriginTracker";
import { RatingSheet } from "@/components/RatingSheet";
import { SearchListPicker } from "@/components/tmdb-search/SearchListPicker";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { formatStarScore } from "@/lib/labels";
import { WATCHLIST_SAVE_LABEL } from "@/lib/mark-seen";
import type { SelectableList } from "@/lib/list-selection";
import { useSpringFeedback } from "@/lib/motion";
import type { AddTitleFromTmdbInput } from "@/lib/add-title-from-tmdb";
import { handoffKey, writeFichaHandoff } from "@/lib/ficha-handoff";
import { showDiaryRemovedToast } from "@/lib/diary-undo";
import { diaryDayLabel, diaryMonthHref, ownedFichaHref, type DiaryLog } from "@/lib/title-preview";
import { showToast } from "@/lib/toast";
import { PARA_TI_SLUG } from "@/lib/tonight/select";
import { TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
import { focusRing } from "@/lib/ui";
import { useStickyOptimistic } from "@/lib/use-optimistic-action";

const HOY_PARA_TI_HREF = `/?${TONIGHT_LENS_PARAM}=${PARA_TI_SLUG}`;

/** The film as the ficha preview knows it: enough to create the user's Title. */
export type FichaTmdbSnapshot = Pick<
  AddTitleFromTmdbInput,
  "tmdbId" | "kind" | "name" | "originalName" | "year" | "posterPath"
>;

type TitleFichaActionsProps = {
  /**
   * The user's Title. Null on a ficha preview (FIL-I8): every action first
   * creates the Title from `snapshot`, then the URL becomes `/titulos/{id}`.
   */
  titleId: string | null;
  snapshot?: FichaTmdbSnapshot;
  /** Diario mode (Buscar from the calendar): the primary logs a viewing on that day. */
  diaryLog?: DiaryLog | null;
  titleName: string;
  watched: boolean;
  /** Calendar day `YYYY-MM-DD` already on the entry. Deshacer puts this date back. */
  watchedAt?: string | null;
  inWatchlist: boolean;
  /** Saved lists (Quiero ver excluded). */
  listCount: number;
  rating: number | null;
  review: string | null;
  /** Saved «Dónde la vi»; prefills the Marqué visto sheet. */
  platform: Platform | null;
  /** This title is tonight's pin right now. */
  pinnedTonight: boolean;
  /** The user's lists panel; a preview passes `previewLists` instead (nothing is written until confirmed). */
  listsPanel?: ReactNode;
  previewLists?: SelectableList[];
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
  snapshot,
  diaryLog = null,
  titleName,
  watched,
  watchedAt = null,
  inWatchlist,
  listCount,
  rating,
  review,
  platform,
  pinnedTonight,
  listsPanel,
  previewLists = [],
}: TitleFichaActionsProps) => {
  const router = useRouter();
  const listsPanelId = useId();
  const [listsOpen, setListsOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [seenOpen, setSeenOpen] = useState(false);
  const [seenOptimistic, setSeenOptimistic] = useState(false);
  const [diaryHold, setDiaryHold] = useState<null | "removed" | "restoring">(null);
  const [seenWatched, setSeenWatched] = useState(watched);
  if (watched !== seenWatched) {
    setSeenWatched(watched);
    if (diaryHold === "removed" && !watched) {
      setDiaryHold(null);
    } else if (diaryHold === "restoring" && watched) {
      setDiaryHold(null);
    }
  }
  const [justPinned, setJustPinned] = useState(false);
  const [isPinning, setPinning] = useState(false);
  const [pendingAction, setPendingAction] = useState<"rating" | "watchlist" | null>(null);
  const { value: state, error, run } = useStickyOptimistic(
    { watched, inWatchlist, rating, review, pinned: pinnedTonight },
    sameActionState,
  );
  const watchedSpring = useSpringFeedback();
  const ratingSpring = useSpringFeedback();
  const watchlistSpring = useSpringFeedback();
  const [isLogging, setLogging] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);
  const [isSavingLists, setSavingLists] = useState(false);

  /** Preview: the Title now exists, so the ficha becomes the user's own. */
  const becomeOwned = (newTitleId: string, learned: { inWatchlist?: boolean; watched?: boolean } = {}) => {
    if (snapshot) {
      writeFichaHandoff(handoffKey(snapshot.kind, snapshot.tmdbId), {
        titleId: newTitleId,
        inWatchlist: Boolean(learned.inWatchlist),
        watched: Boolean(learned.watched),
      });
    }
    const href = ownedFichaHref(newTitleId);
    retargetCurrentNav(href);
    router.replace(href);
  };

  const previewSnapshot = () => {
    if (!snapshot) {
      throw new Error("Falta la película.");
    }
    return snapshot;
  };

  const displayedWatched =
    diaryHold === "restoring" || (diaryHold !== "removed" && (state.watched || seenOptimistic));

  const handlePin = () => {
    if (state.pinned || isPinning) {
      return;
    }
    setPinning(true);
    setJustPinned(true);
    run({ ...state, pinned: true, inWatchlist: true }, async () => {
      try {
        if (titleId == null) {
          const result = await pinTonightFromSearch(previewSnapshot());
          if (!result.ok) {
            throw new Error(result.error);
          }
          showToast({
            title: "Sale primero en Hoy",
            description: `${titleName} · también en Quiero ver`,
            action: { label: "Ver en Hoy", onClick: () => router.push(HOY_PARA_TI_HREF) },
          });
          becomeOwned(result.titleId, { inWatchlist: true });
          return;
        }
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
        if (titleId == null) {
          const result = await addTitleFromTmdb({
            ...previewSnapshot(),
            destination: "watchlist",
            addToWatchlist: true,
          });
          if (!result.ok) {
            throw new Error(result.error);
          }
          becomeOwned(result.titleId, { inWatchlist: true });
        } else if (next) {
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
    if (diaryHold === "restoring") {
      return;
    }
    if (!displayedWatched) {
      setSeenOpen(true);
      return;
    }
    if (titleId == null || !watchedAt) {
      return;
    }
    const isoDate = watchedAt;
    const id = titleId;
    setSeenOptimistic(false);
    setDiaryHold("removed");
    watchedSpring.trigger();
    const clear = clearTitleWatched(id);
    showDiaryRemovedToast({
      clear,
      restore: () => restoreTitleWatched(id, isoDate),
      onUndo: () => setDiaryHold("restoring"),
      onUndoFailed: () => setDiaryHold(null),
    });
    void clear.catch((caught) => {
      setDiaryHold(null);
      showToast({
        title: "No se pudo quitar",
        description: caught instanceof Error ? caught.message : "No se pudo quitar.",
        variant: "error",
      });
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
        if (titleId == null) {
          // Nothing to keep: no Title for an empty nota.
          if (next.rating == null && !next.review) {
            return;
          }
          const result = await rateTmdbTitle(previewSnapshot(), formData);
          if (!result.ok) {
            throw new Error(result.error);
          }
          becomeOwned(result.titleId);
          return;
        }
        await setTitleRating(titleId, formData);
      } finally {
        setPendingAction(null);
      }
    });
  };

  /** Preview «Lista»: the Title is born in the confirmed lists. */
  const handleConfirmPreviewLists = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) {
      setListsOpen(false);
      return;
    }
    setListsError(null);
    setSavingLists(true);
    try {
      const result = await saveTmdbTitleInLists({ tmdb: previewSnapshot(), add: selectedIds });
      if (!result.ok) {
        setListsError(result.error);
        return;
      }
      showToast({
        title: selectedIds.length === 1 ? "Guardada en tu lista" : `Guardada en ${selectedIds.length} listas`,
        description: titleName,
      });
      becomeOwned(result.titleId);
    } finally {
      setSavingLists(false);
    }
  };

  /** Diario mode: log the viewing on the calendar's day and go back to that month. */
  const handleLogDiary = () => {
    if (!diaryLog || isLogging) {
      return;
    }
    setLogging(true);
    const dayLabel = diaryDayLabel(diaryLog.date);
    run({ ...state, watched: true, inWatchlist: false }, async () => {
      try {
        if (titleId == null) {
          const result = await addTitleFromTmdb({
            ...previewSnapshot(),
            destination: "watched",
            watchedAt: diaryLog.date,
          });
          if (!result.ok) {
            throw new Error(result.error);
          }
          const film = previewSnapshot();
          writeFichaHandoff(handoffKey(film.kind, film.tmdbId), {
            titleId: result.titleId,
            inWatchlist: false,
            watched: true,
          });
        } else {
          const formData = new FormData();
          if (diaryLog.date) {
            formData.set("watchedAt", diaryLog.date);
          }
          await markTitleWatched(titleId, formData);
        }
        showToast({ title: "En tu Diario", description: `${titleName} · ${dayLabel}` });
        router.push(diaryMonthHref(diaryLog.date));
      } finally {
        setLogging(false);
      }
    });
  };

  return (
    <div
      className="ficha-actions-a ficha-enter space-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:space-y-0"
      style={{ "--i": 5 } as CSSProperties}
    >
      {diaryLog ? (
        <button
          type="button"
          onClick={handleLogDiary}
          disabled={isLogging}
          aria-busy={isLogging || undefined}
          className={cn(
            "press-scale relative flex h-[3.25rem] w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-success px-5 text-base font-semibold text-ink disabled:opacity-70 sm:w-auto sm:px-7",
            focusRing,
          )}
        >
          <CheckIcon />
          {isLogging ? "Anotando…" : `Registrar vista · ${diaryDayLabel(diaryLog.date)}`}
        </button>
      ) : displayedWatched ? null : state.pinned ? (
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

      <div
        role="group"
        aria-label="Acciones del título"
        className={cn(
          "ficha-action-group grid gap-1 p-1.5 sm:flex sm:gap-0.5 sm:rounded-full sm:p-1",
          diaryLog ? "grid-cols-3" : "grid-cols-4",
        )}
      >
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

        {diaryLog ? null : (
          <button
            type="button"
            onClick={handleToggleWatched}
            disabled={diaryHold === "restoring"}
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
        )}

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
          {titleId == null ? (
            <div className="ficha-action-group rounded-[1.375rem] p-4">
              <SearchListPicker
                lists={previewLists}
                initialIds={[]}
                pending={isSavingLists}
                error={listsError}
                onCancel={() => setListsOpen(false)}
                onConfirm={(ids) => void handleConfirmPreviewLists(ids)}
              />
            </div>
          ) : (
            listsPanel
          )}
        </div>
      ) : null}

      <MarkWatchedSheet
        open={seenOpen}
        titleId={titleId ?? `preview:${snapshot?.kind}:${snapshot?.tmdbId}`}
        titleName={titleName}
        rating={state.rating}
        review={state.review}
        platform={platform}
        saveLabel={state.inWatchlist ? WATCHLIST_SAVE_LABEL : "Guardar en el diario"}
        onClose={() => setSeenOpen(false)}
        onSaved={() => {
          setSeenOptimistic(true);
          setDiaryHold(null);
          watchedSpring.trigger();
        }}
        onError={() => setSeenOptimistic(false)}
        submit={
          titleId == null
            ? async (formData) => {
                const result = await markTmdbTitleWatched(previewSnapshot(), formData);
                if (!result.ok) {
                  throw new Error(result.error);
                }
                becomeOwned(result.titleId, { watched: true });
              }
            : undefined
        }
      />

      <RatingSheet
        open={ratingOpen}
        titleId={titleId ?? "preview"}
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
