"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createHistoryEntryStore, readHistoryEntry, writeHistoryEntry } from "@/lib/history-entry";
import { WatchlistFicha } from "@/components/watchlist/WatchlistFicha";
import { WatchlistHeroCompact } from "@/components/watchlist/WatchlistHeroCompact";
import { WatchlistReorderList } from "@/components/watchlist/WatchlistReorderList";
import { WatchlistSheets } from "@/components/watchlist/WatchlistSheets";
import { WatchlistStage } from "@/components/watchlist/WatchlistStage";
import { WatchlistStickyBar } from "@/components/watchlist/WatchlistStickyBar";
import type { FichaView } from "@/components/watchlist/types";
import { useFichaViews } from "@/components/watchlist/useFichaViews";
import { useWatchlistActions } from "@/components/watchlist/useWatchlistActions";
import { useWatchlistKeyboard } from "@/components/watchlist/useWatchlistKeyboard";
import { isNight } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight/types";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { useMountedNow } from "@/lib/use-mounted-now";
import { sameOrderedIds, useStickyOptimistic } from "@/lib/use-optimistic-action";
import type { WatchlistFicha as WatchlistFichaRow } from "@/lib/watchlist-ficha";

type WatchlistCarteleraProps = {
  fichas: WatchlistFichaRow[];
  listId: string;
  nightEnds: NightEnds;
  /** Manual order is only meaningful on the unfiltered, unsorted queue. */
  isManualOrder?: boolean;
  /** «Esta noche» chip: keep only what fits before bedtime (needs the viewer's clock). */
  tonightOnly?: boolean;
  pinnedTitleId?: string | null;
};

const STAGGER_CAP = 12;

/**
 * Quiero ver «La cartelera»: compact hero for #1, dense fichas that unfold in
 * place, swipe / long-press actions, Reordenar, and a stage on desktop.
 */
const EXPANDED_ENTRY = "watchlistExpanded";
const readExpandedEntry = () => readHistoryEntry(EXPANDED_ENTRY);

export const WatchlistCartelera = ({
  fichas,
  listId,
  nightEnds,
  isManualOrder = true,
  tonightOnly = false,
  pinnedTitleId = null,
}: WatchlistCarteleraProps) => {
  const router = useRouter();
  const now = useMountedNow();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const serverIds = useMemo(() => fichas.map((ficha) => ficha.id), [fichas]);
  const byId = useMemo(() => new Map(fichas.map((ficha) => [ficha.id, ficha])), [fichas]);
  const { value: order, error, isPending, run } = useStickyOptimistic(serverIds, sameOrderedIds);

  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isEditing, setIsEditing] = useState(false);
  // Back from a ficha reopens the row that was open (read after hydration; this history entry only).
  const [expandedStore] = useState(() => createHistoryEntryStore(EXPANDED_ENTRY));
  const restoredExpandedId = useSyncExternalStore(
    expandedStore.subscribe,
    expandedStore.getSnapshot,
    expandedStore.getServerSnapshot,
  );
  const [touchedExpandedId, setExpandedId] = useState<string | null | undefined>(undefined);
  const expandedId = touchedExpandedId === undefined ? restoredExpandedId : touchedExpandedId;
  useEffect(() => {
    if (touchedExpandedId !== undefined) {
      writeHistoryEntry(EXPANDED_ENTRY, touchedExpandedId);
    }
  }, [touchedExpandedId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stampedId, setStampedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(pinnedTitleId);
  const [snoozed, setSnoozed] = useState<ReadonlyMap<string, Date>>(() => new Map());
  const [notes, setNotes] = useState<ReadonlyMap<string, string | null>>(() => new Map());
  const [markTarget, setMarkTarget] = useState<FichaView | null>(null);
  const [menuTarget, setMenuTarget] = useState<FichaView | null>(null);
  const [noteTarget, setNoteTarget] = useState<FichaView | null>(null);
  const [condensed, setCondensed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setCondensed(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0)),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
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
  // «Esta noche» only bites at night; by day everything fits and the list stays whole.
  const visible = useMemo(
    () =>
      tonightOnly && now && isNight(now, nightEnds)
        ? views.filter((view) => view.fit && view.fit.overflowMinutes === 0 && view.fit.remainingMinutes > 0)
        : views,
    [nightEnds, now, tonightOnly, views],
  );
  const visibleIds = visible.map((view) => view.id);
  const hiddenInOrder = order.filter((id) => !visibleIds.includes(id));
  const [hero, ...rows] = visible;
  const selected = (selectedId && visible.find((view) => view.id === selectedId)) || hero || null;

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
  const toggle = useCallback(
    (ficha: FichaView) =>
      setExpandedId((current) => {
        const open = current === undefined ? readExpandedEntry() : current;
        return open === ficha.id ? null : ficha.id;
      }),
    [],
  );
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

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface/40 px-4 py-8 text-center text-sm text-fog" role="status">
        {tonightOnly
          ? "Nada termina antes de tu hora de dormir. Quita «Esta noche» para ver toda la lista."
          : "Nada en Quiero ver por ahora."}
      </p>
    );
  }

  const canReorder = isManualOrder && visible.length > 1;

  return (
    <div className="relative space-y-4">
      <div ref={sentinelRef} aria-hidden="true" className="absolute left-0 top-0 h-px w-px" />
      <WatchlistStickyBar
        count={visible.length}
        condensed={condensed}
        isEditing={isEditing}
        canReorder={canReorder}
        reorderBlocked={!canReorder && visible.length > 1}
        onToggleEditing={() => setIsEditing((current) => !current)}
      />

      {isEditing && canReorder ? (
        <WatchlistReorderList items={visible} isPending={isPending} onMove={actions.move} onReorder={actions.reorder} />
      ) : (
        <div className="lg:flex lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-4 lg:flex-[999_1_560px]">
            {hero ? (
              <WatchlistHeroCompact key={hero.id} ficha={hero} stamped={stampedId === hero.id} onMarkSeen={openMark} onMenu={openMenu} />
            ) : null}
            {rows.length > 0 ? (
              <ol className="space-y-2.5" aria-label="Después">
                {rows.map((ficha, index) => (
                  <WatchlistFicha
                    key={ficha.id}
                    ficha={ficha}
                    rank={index + 2}
                    expanded={expandedId === ficha.id}
                    selected={selected?.id === ficha.id}
                    stamped={stampedId === ficha.id}
                    stagger={Math.min(index, STAGGER_CAP)}
                    desktop={isDesktop}
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
        onWatchedSaved={(ficha) => {
          setMarkTarget(null);
          setExpandedId(null);
          actions.onWatchedSaved(ficha);
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
