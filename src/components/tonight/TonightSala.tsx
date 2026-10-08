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
import { cn } from "@/lib/cn";
import {
  coverflowStartIndex,
  resolveCategoryNeighbor,
} from "@/lib/diary-category-continuum";
import { showToast } from "@/lib/toast";
import { rankForNow } from "@/lib/tonight/serve";
import { dayPartOf } from "@/lib/tonight/time";
import type { TonightDecks } from "@/lib/tonight-store";

export const TONIGHT_LENS_PARAM = "lente";
const DEAL_MS = 700;
const STAMP_TO_FLIGHT_MS = 0;

type TonightSalaProps = {
  decks: TonightDecks;
  initialSlug?: string | null;
};

export const TonightSala = ({ decks, initialSlug = null }: TonightSalaProps) => {
  const now = useTonightClock(decks.nightEnds);
  const dayPart = now ? dayPartOf(now, decks.nightEnds) : "noche";
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [activeSlug, setActiveSlug] = useState(
    () => decks.lenses.find((lens) => lens.slug === initialSlug)?.slug ?? decks.lenses[0]?.slug ?? "",
  );
  const [startIndex, setStartIndex] = useState(0);
  const [transitionClass, setTransitionClass] = useState<string | null>(null);
  const [dealing, setDealing] = useState(true);
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

  const activeLens = lenses.find((lens) => lens.slug === activeSlug) ?? lenses[0] ?? null;
  const cards = activeLens ? (lensCards.get(activeLens.slug) ?? []) : [];

  const announce = (name: string) => {
    if (liveRef.current) {
      liveRef.current.textContent = `Lente ${name}`;
    }
  };

  // Edge swipe into the next lens: glide only. Re-dealing the cards here felt like a reload;
  // the deal stays for the first paint of the sala.
  const playTransition = (direction: "prev" | "next") => {
    setTransitionClass(direction === "next" ? "que-ver-deck-slide-next" : "que-ver-deck-slide-prev");
    later(() => setTransitionClass(null), 240);
  };

  const goToLens = useCallback(
    (slug: string, start: "first" | "last", direction?: "prev" | "next") => {
      const lens = lenses.find((item) => item.slug === slug);
      if (!lens) {
        return;
      }
      if (direction) {
        playTransition(direction);
      }
      setActiveSlug(slug);
      setStartIndex(coverflowStartIndex(lens.count, start));
      announce(lens.name);
      // Shallow URL sync: router.replace would refetch the server page before the deck feels settled.
      window.history.replaceState(null, "", `/?${TONIGHT_LENS_PARAM}=${encodeURIComponent(slug)}`);
    },
    // playTransition only touches state setters + timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lenses],
  );

  const edgeNeighbors = useMemo(() => {
    if (!activeLens) {
      return { prev: null, next: null };
    }
    // The destination peeks the poster the visitor will land on (first of next, last of prev).
    const withPoster = (direction: "prev" | "next") => {
      const neighbor = resolveCategoryNeighbor(lenses, activeLens.slug, direction);
      if (!neighbor) {
        return null;
      }
      const titles = lensCards.get(neighbor.slug) ?? [];
      const landing = neighbor.startIndex === "first" ? titles[0] : titles[titles.length - 1];
      return { ...neighbor, posterPath: landing?.posterPath ?? null };
    };
    return { prev: withPoster("prev"), next: withPoster("next") };
  }, [activeLens, lensCards, lenses]);

  const handleEdgeNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!activeLens) {
        return;
      }
      const neighbor = resolveCategoryNeighbor(lenses, activeLens.slug, direction);
      if (neighbor) {
        goToLens(neighbor.slug, neighbor.startIndex, direction);
      }
    },
    [activeLens, goToLens, lenses],
  );

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
    void markNotTonight(title.id, activeLens?.slug).catch(() => {
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

  const handleActiveChange = useCallback(
    (_index: number, title: CoverflowTitle) => {
      impressions.onHeroChange(title.id);
    },
    [impressions],
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
                onSelect={(slug) => goToLens(slug, "first")}
                label="Lentes de hoy"
              />
            </div>
            <div ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />
            <div className={cn("flex min-h-0 flex-1 flex-col", transitionClass, dealing && "deck-deal")}>
              <CoverflowDeck
                key={`${activeLens.slug}-${startIndex}-${cards[0]?.id ?? "empty"}`}
                titles={cards}
                footer="tonight"
                className="min-h-0 flex-1"
                initialIndex={startIndex}
                onEdgeNavigate={handleEdgeNavigate}
                edgeNeighbors={edgeNeighbors}
                onActiveChange={handleActiveChange}
              />
            </div>
          </div>
        )}
        <WhySheet title={whyTitle} lens={activeLens?.slug ?? ""} onClose={() => setWhyTitle(null)} />
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
