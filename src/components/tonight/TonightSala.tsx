"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markNotTonight } from "@/app/actions/tonight";
import { removeFromWatchlist, undoMarkWatched } from "@/app/actions/watchlist";
import { CoverflowDeck } from "@/components/CoverflowDeck";
import { EmptyState } from "@/components/EmptyState";
import { GenreCoverflow } from "@/components/GenreCoverflow";
import { HoyDeckSkeleton } from "@/components/PageSkeletons";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { TonightCardMenu } from "@/components/tonight/TonightCardMenu";
import { TonightProvider, type TonightHandlers } from "@/components/tonight/TonightContext";
import { TonightEyebrow } from "@/components/tonight/TonightEyebrow";
import { WhySheet } from "@/components/tonight/WhySheet";
import { useImpressions } from "@/components/tonight/useImpressions";
import { useTonightClock } from "@/components/tonight/useTonightClock";
import { useNavLabel } from "@/components/NavOriginTracker";
import { cn } from "@/lib/cn";
import { DECK_CARD_PARAM, deckCardFrom, deckIndexOf } from "@/lib/nav-origin";
import { showToast } from "@/lib/toast";
import { rankForNow, TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
import { dayPartOf } from "@/lib/tonight/time";
import type { TonightDecks } from "@/lib/tonight-store";

const DEAL_MS = 700;
const STAMP_TO_FLIGHT_MS = 0;

type TonightSalaProps = {
  decks: TonightDecks;
  initialSlug?: string | null;
  /** `?carta=`: the card the user left for a ficha; the deck reopens on it. */
  initialCardId?: string | null;
};

export const TonightSala = ({ decks, initialSlug = null, initialCardId = null }: TonightSalaProps) => {
  const now = useTonightClock(decks.nightEnds);
  const dayPart = now ? dayPartOf(now, decks.nightEnds) : "noche";
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [activeSlug, setActiveSlug] = useState(
    () => decks.lenses.find((lens) => lens.slug === initialSlug)?.slug ?? decks.lenses[0]?.slug ?? "",
  );
  const activeSlugRef = useRef(activeSlug);
  const [focusRequest, setFocusRequest] = useState<{ index: number; seq: number }>();
  // On Back the client mounts fresh: the URL (kept by replaceState) beats the cached server props.
  const [rememberedCard] = useState(() =>
    typeof window === "undefined" ? initialCardId : (deckCardFrom(window.location.search) ?? initialCardId),
  );
  // Coming back to a card is not a new deal: no `.deck-deal` replay.
  const [dealing, setDealing] = useState(() => !rememberedCard);
  const [whyTitle, setWhyTitle] = useState<CoverflowTitle | null>(null);
  const [menuTitle, setMenuTitle] = useState<CoverflowTitle | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const impressions = useImpressions(activeSlug);

  useEffect(
    () => () => {
      for (const timer of timers.current) {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  const later = useCallback((fn: () => void, ms: number) => {
    const timer = window.setTimeout(fn, ms);
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    if (!now) {
      return;
    }
    later(() => setDealing(false), DEAL_MS);
  }, [later, now]);

  /** Cards per lens, ranked for right now (fit with the clock, fresh fatigue). */
  const lensCards = useMemo(() => {
    const map = new Map<string, CoverflowTitle[]>();
    if (!now) {
      return map;
    }
    for (const lens of decks.lenses) {
      const visible = lens.titles.filter((title) => !hidden.has(title.id));
      const ranked = rankForNow(visible, {
        now,
        nightEnds: decks.nightEnds,
        keepWildcardLast: lens.kind === "para-ti",
        keepPinnedFirst: lens.kind === "para-ti",
      });
      map.set(
        lens.slug,
        ranked.map((card) => ({
          ...card,
          tonight: {
            runtimeMinutes: card.runtimeMinutes,
            reasons: card.reasons,
            headline: card.headline,
            fit: card.fit,
            wildcard: card.wildcard,
            pinned: card.pinned,
            queueNote: card.queueNote,
            lens: lens.slug,
            posterAmbient: card.posterAmbient,
          },
        })),
      );
    }
    return map;
  }, [decks, hidden, now]);

  const lenses = useMemo(
    () =>
      decks.lenses
        .filter((lens) => (lensCards.get(lens.slug)?.length ?? 0) > 0)
        .map((lens, index) => ({
          id: index,
          name: lens.name,
          slug: lens.slug,
          count: lensCards.get(lens.slug)?.length ?? 0,
          averageImdb: 0,
        })),
    [decks.lenses, lensCards],
  );

  /**
   * One continuous deck. The selector builds the lenses as disjoint chapters of a single ranked
   * queue, so crossing Para ti → Drama is just the next card: same physics, no wall, no remount.
   * The rail follows the hero's lens; tapping a lens jumps the deck to that chapter.
   */
  const { cards, lensStarts } = useMemo(() => {
    const starts = new Map<string, number>();
    const all: CoverflowTitle[] = [];
    for (const lens of lenses) {
      starts.set(lens.slug, all.length);
      all.push(...(lensCards.get(lens.slug) ?? []));
    }
    return { cards: all, lensStarts: starts };
  }, [lensCards, lenses]);

  const activeLens = lenses.find((lens) => lens.slug === activeSlug) ?? lenses[0] ?? null;
  useNavLabel(activeLens ? `Hoy · ${activeLens.name}` : "Hoy");

  const goToLens = (slug: string) => {
    const index = lensStarts.get(slug);
    if (index == null) {
      return;
    }
    setFocusRequest((current) => ({ index, seq: (current?.seq ?? 0) + 1 }));
  };

  const hide = (titleId: string) => setHidden((current) => new Set(current).add(titleId));
  const unhide = (titleId: string) =>
    setHidden((current) => {
      const next = new Set(current);
      next.delete(titleId);
      return next;
    });

  const handlers: TonightHandlers = {
    lens: activeLens?.slug ?? "",
    dayPart,
    onWhy: (title) => setWhyTitle(title),
    onOpenMenu: (title) => setMenuTitle(title),
    onOpened: (title) => impressions.push(title.id, "opened"),
    onWatched: (title) => {
      impressions.push(title.id, "watched");
      hide(title.id);
      showToast({
        title: "En tu diario",
        description: title.name,
        durationMs: 6000,
        action: {
          label: "Deshacer",
          onClick: () => {
            unhide(title.id);
            void undoMarkWatched(title.id).catch(() => {
              showToast({ title: "No se pudo deshacer", variant: "error" });
            });
          },
        },
      });
    },
    onWatchError: (title, message) => {
      unhide(title.id);
      showToast({ title: "No se pudo guardar", description: message, variant: "error" });
    },
  };

  const handleNotTonight = (title: CoverflowTitle) => {
    setMenuTitle(null);
    hide(title.id);
    showToast({ title: "Ahora no", description: `${title.name} vuelve en dos semanas.` });
    void markNotTonight(title.id, title.tonight?.lens ?? activeLens?.slug).catch(() => {
      unhide(title.id);
      showToast({ title: "No se pudo guardar", variant: "error" });
    });
  };

  const handleRemove = (title: CoverflowTitle) => {
    setMenuTitle(null);
    hide(title.id);
    showToast({ title: "Fuera de Quiero ver", description: title.name });
    void removeFromWatchlist(title.id).catch(() => {
      unhide(title.id);
      showToast({ title: "No se pudo quitar", variant: "error" });
    });
  };

  // The hero's own lens drives the rail; lens + card live in the URL (impressions settle the previous hero first).
  const handleActiveChange = useCallback(
    (_index: number, title: CoverflowTitle) => {
      impressions.onHeroChange(title.id);
      const slug = title.tonight?.lens;
      if (!slug) {
        return;
      }
      // Shallow URL sync: router.replace would refetch the server page mid-swipe.
      window.history.replaceState(
        null,
        "",
        `/?${TONIGHT_LENS_PARAM}=${encodeURIComponent(slug)}&${DECK_CARD_PARAM}=${encodeURIComponent(title.id)}`,
      );
      if (slug === activeSlugRef.current) {
        return;
      }
      activeSlugRef.current = slug;
      setActiveSlug(slug);
      const lens = lenses.find((item) => item.slug === slug);
      if (lens && liveRef.current) {
        liveRef.current.textContent = `Lente ${lens.name}`;
      }
    },
    [impressions, lenses],
  );

  void STAMP_TO_FLIGHT_MS;

  return (
    <TonightProvider value={handlers}>
      <div className="diario-que-ver-shell tonight-sala flex min-h-0 flex-1 flex-col gap-2 sm:gap-3 max-sm:-mt-1">
        <div className="shrink-0">
          <TonightEyebrow now={now} nightEnds={decks.nightEnds} />
        </div>
        {!now ? (
          <HoyDeckSkeleton />
        ) : lenses.length === 0 || !activeLens ? (
          <EmptyState
            title="Por hoy, listo"
            description="Ya no queda nada en el mazo de hoy. Añade títulos a Quiero ver o vuelve mañana."
            actionHref="/watchlist"
            actionLabel="Ir a Quiero ver"
          />
        ) : (
          <div className="diario-que-ver-body flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-3">
            <div className="shrink-0">
              <GenreCoverflow
                categories={lenses}
                activeSlug={activeLens.slug}
                onSelect={goToLens}
                label="Lentes de hoy"
              />
            </div>
            <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />
            <div className={cn("flex min-h-0 flex-1 flex-col", dealing && "deck-deal")}>
              <CoverflowDeck
                titles={cards}
                footer="tonight"
                className="min-h-0 flex-1"
                // Read on mount only: the remembered card, else the ?lente= chapter, else the top.
                initialIndex={deckIndexOf(cards, rememberedCard) ?? lensStarts.get(activeSlug) ?? 0}
                focusRequest={focusRequest}
                onActiveChange={handleActiveChange}
              />
            </div>
          </div>
        )}
        <WhySheet
          title={whyTitle}
          lens={whyTitle?.tonight?.lens ?? activeLens?.slug ?? ""}
          onClose={() => setWhyTitle(null)}
        />
        <TonightCardMenu
          title={menuTitle}
          onClose={() => setMenuTitle(null)}
          onNotTonight={handleNotTonight}
          onRemove={handleRemove}
        />
      </div>
    </TonightProvider>
  );
};
