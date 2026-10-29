"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WatchlistClosingCard } from "@/components/watchlist/WatchlistClosingCard";
import { WatchlistFicha } from "@/components/watchlist/WatchlistFicha";
import { WatchlistHeroCompact } from "@/components/watchlist/WatchlistHeroCompact";
import { WatchlistReorderList } from "@/components/watchlist/WatchlistReorderList";
import { useWatchlistEditing } from "@/components/watchlist/WatchlistEditing";
import { WatchlistSheets } from "@/components/watchlist/WatchlistSheets";
import { WatchlistStage } from "@/components/watchlist/WatchlistStage";
import { WatchlistStickyBar } from "@/components/watchlist/WatchlistStickyBar";
import type { FichaView } from "@/components/watchlist/types";
import { useExpandedFicha } from "@/components/watchlist/useExpandedFicha";
import { useFichaViews } from "@/components/watchlist/useFichaViews";
import { useWatchlistActions } from "@/components/watchlist/useWatchlistActions";
import { useWatchlistKeyboard } from "@/components/watchlist/useWatchlistKeyboard";
import { isNight } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight/types";
import { safeAreaStickyUnderHeaderClass } from "@/lib/ui";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { useMountedNow } from "@/lib/use-mounted-now";
import { sameOrderedIds, useStickyOptimistic } from "@/lib/use-optimistic-action";
import { heroEyebrow } from "@/lib/watchlist-empty";
import type { WatchlistFicha as WatchlistFichaRow } from "@/lib/watchlist-ficha";
import type { WatchlistQuery } from "@/lib/watchlist-query";

type WatchlistCarteleraProps = {
  /** The whole list, in its manual order (reordering always works on all of it). */
  fichas: WatchlistFichaRow[];
  /** What the header's scope, filters and order leave, in that order (FIL-I34). */
  displayIds?: readonly string[];
  listId: string;
  nightEnds: NightEnds;
  pinnedTitleId?: string | null;
  /** Active order: the hero's eyebrow says what the first row is and the ranks step aside (FIL-I24-4). */
  order?: Pick<WatchlistQuery, "sort" | "dir">;
  /** Nothing left after filtering (the header's exits). */
  emptyState?: ReactNode;
  /** Filters or an order paused while reordering. */
  paused?: { filters: number; order: boolean } | null;
};

const STAGGER_CAP = 12;

/**
 * Quiero ver «La cartelera»: compact hero for #1, dense fichas that unfold in
 * place, swipe / long-press actions, Reordenar, and a stage on desktop.
 */
export const WatchlistCartelera = ({
  fichas,
  displayIds,
  listId,
  nightEnds,
  pinnedTitleId = null,
  order: sortQuery = { sort: null, dir: null },
  emptyState = null,
  paused = null,
}: WatchlistCarteleraProps) => {
  const router = useRouter();
  const now = useMountedNow();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const serverIds = useMemo(() => fichas.map((ficha) => ficha.id), [fichas]);
  const byId = useMemo(() => new Map(fichas.map((ficha) => [ficha.id, ficha])), [fichas]);
  const { value: order, error, isPending, run } = useStickyOptimistic(serverIds, sameOrderedIds);

  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  // Reorder mode lives in the page's provider when the compact header owns the button (FIL-I21-7).
  const sharedEditing = useWatchlistEditing();
  const [localEditing, setLocalEditing] = useState(false);
  const isEditing = sharedEditing ? sharedEditing.isEditing : localEditing;
  const setIsEditing = sharedEditing ? sharedEditing.setIsEditing : setLocalEditing;
  const { expandedId, toggle, close: closeExpanded } = useExpandedFicha();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stampedId, setStampedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(pinnedTitleId);
  const [snoozed, setSnoozed] = useState<ReadonlyMap<string, Date>>(() => new Map());
  const [notes, setNotes] = useState<ReadonlyMap<string, string | null>>(() => new Map());
  const [markTarget, setMarkTarget] = useState<FichaView | null>(null);
  const [menuTarget, setMenuTarget] = useState<FichaView | null>(null);
  const [noteTarget, setNoteTarget] = useState<FichaView | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const hide = useCallback((id: string) => setHiddenIds((current) => new Set(current).add(id)), []);
  const restore = useCallback(
    (id: string) =>
      setHiddenIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      }),
    [],
  );
  const setSnoozedUntil = useCallback((id: string, until: Date | null) => {
    setSnoozed((current) => {
      const next = new Map(current);
      if (until) next.set(id, until);
      else next.delete(id);
      return next;
    });
  }, []);
  const setNote = useCallback((id: string, note: string | null) => {
    setNotes((current) => new Map(current).set(id, note));
  }, []);

  const views = useFichaViews({ order, byId, hiddenIds, now, nightEnds, notes, snoozed, pinnedId });
  const sort = sortQuery.sort;
  // Reordering shows the whole list with filters paused; otherwise the header's result. In Mi
  // orden the optimistic order wins (a move shows before the server answers).
  const visible = useMemo(() => {
    if (isEditing || !displayIds) return views;
    if (sort === null) {
      const shown = new Set(displayIds);
      return views.filter((view) => shown.has(view.id));
    }
    const byView = new Map(views.map((view) => [view.id, view]));
    return displayIds.flatMap((id) => byView.get(id) ?? []);
  }, [displayIds, isEditing, sort, views]);
  const visibleIds = visible.map((view) => view.id);
  const hiddenInOrder = order.filter((id) => !visibleIds.includes(id));
  // Desktop (FIL-I24-6): no compact hero; the list starts at #1 and the sticky stage is the hero.
  const hero = isDesktop ? null : (visible[0] ?? null);
  const rows = isDesktop ? visible : visible.slice(1);
  const first = visible[0] ?? null;
  const selected = (selectedId && visible.find((view) => view.id === selectedId)) || first || null;

  const actions = useWatchlistActions({
    listId,
    order,
    visibleIds,
    hiddenInOrder,
    run,
    hide,
    restore,
    setStampedId,
    setPinnedId,
    setSnoozedUntil,
    setNote,
    later,
  });

  const openMark = useCallback((ficha: FichaView) => {
    setMenuTarget(null);
    setMarkTarget(ficha);
  }, []);
  const select = useCallback((ficha: FichaView) => setSelectedId(ficha.id), []);
  const openMenu = useCallback((ficha: FichaView) => setMenuTarget(ficha), []);
  const sheetsOpen = Boolean(markTarget || menuTarget || noteTarget);

  useWatchlistKeyboard({
    enabled: isDesktop && !isEditing && !sheetsOpen,
    ids: visibleIds,
    selectedId: selected?.id ?? null,
    onSelect: (id) => setSelectedId(id),
    onOpen: (id) => router.push(`/titulos/${id}`),
    onMark: (id) => {
      const ficha = visible.find((view) => view.id === id);
      if (ficha) openMark(ficha);
    },
  });

  const canReorder = views.length > 1;
  const ranked = sort === null;
  const empty = visible.length === 0;
  // Closing card (FIL-I24-7): how many fit before bedtime, only at night (fit is null by day).
  const fitCount =
    now && isNight(now, nightEnds)
      ? views.filter((view) => view.fit && view.fit.overflowMinutes === 0 && view.fit.remainingMinutes > 0).length
      : null;

  return (
    <div className="relative space-y-4">
      {isEditing ? (
        <WatchlistStickyBar paused={paused} total={views.length} onDone={() => setIsEditing(false)} className={safeAreaStickyUnderHeaderClass} />
      ) : null}

      {empty && !isEditing ? (
        emptyState
      ) : isEditing && canReorder ? (
        <WatchlistReorderList items={visible} isPending={isPending} onMove={actions.move} onReorder={actions.reorder} />
      ) : (
        <div className="lg:flex lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-4 lg:flex-[999_1_560px]">
            {hero ? (
              <WatchlistHeroCompact
                key={hero.id}
                ficha={hero}
                stamped={stampedId === hero.id}
                eyebrow={heroEyebrow(sortQuery, hero.platform?.label)}
                ranked={ranked}
                onMarkSeen={openMark}
                onMenu={openMenu}
              />
            ) : null}
            {rows.length > 0 ? (
              <ol className="space-y-2.5" aria-label={isDesktop ? "Quiero ver" : "Después"}>
                {rows.map((ficha, index) => (
                  <WatchlistFicha
                    key={ficha.id}
                    ficha={ficha}
                    rank={isDesktop ? index + 1 : index + 2}
                    lead={isDesktop && index === 0 ? heroEyebrow(sortQuery, ficha.platform?.label) : null}
                    expanded={expandedId === ficha.id}
                    selected={selected?.id === ficha.id}
                    stamped={stampedId === ficha.id}
                    stagger={Math.min(index, STAGGER_CAP)}
                    desktop={isDesktop}
                    // The first folded row may teach the swipe (once a day; the row decides).
                    hint={index === 0 && !isDesktop}
                    ranked={ranked}
                    onToggle={toggle}
                    onSelect={select}
                    onMarkSeen={openMark}
                    onTonight={actions.tonight}
                    onNotTonight={actions.notTonight}
                    onMenu={openMenu}
                  />
                ))}
              </ol>
            ) : null}
            {visible.length > 1 ? <WatchlistClosingCard total={visible.length} fitCount={fitCount} /> : null}
          </div>
          {isDesktop && selected ? (
            <div className="hidden lg:sticky lg:top-[calc(3.5rem+env(safe-area-inset-top)+1rem)] lg:block lg:w-[400px] lg:shrink-0">
              <WatchlistStage ficha={selected} onMarkSeen={openMark} onTonight={actions.tonight} onMenu={openMenu} />
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <div role="alert" className="space-y-2 rounded-2xl border border-danger-line bg-danger-well px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <p className="text-xs text-fog">El orden o la baja no se guardó. Inténtalo de nuevo.</p>
        </div>
      ) : null}

      <WatchlistSheets
        markTarget={markTarget}
        menuTarget={menuTarget}
        noteTarget={noteTarget}
        onCloseMark={() => setMarkTarget(null)}
        onWatchedSaved={(ficha, rating) => {
          setMarkTarget(null);
          closeExpanded();
          actions.onWatchedSaved(ficha, rating);
        }}
        onWatchedError={actions.onWatchedError}
        onCloseMenu={() => setMenuTarget(null)}
        onTonight={actions.tonight}
        onMoveToTop={actions.moveToTop}
        onNote={setNoteTarget}
        onNotTonight={actions.notTonight}
        onRemove={actions.remove}
        onCloseNote={() => setNoteTarget(null)}
        onSaveNote={(ficha, note) => {
          setNoteTarget(null);
          actions.saveNote(ficha, note);
        }}
      />
    </div>
  );
};
