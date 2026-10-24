"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parkRuta, rutaAfterWatch, universoBridge } from "@/app/actions/rutas";
import { markNotTonight, sendTasteFeedback } from "@/app/actions/tonight";
import { removeFromWatchlist, undoMarkWatched } from "@/app/actions/watchlist";
import { CoverflowDeck } from "@/components/CoverflowDeck";
import { GenreCoverflow } from "@/components/GenreCoverflow";
import { HoyDeckSkeleton } from "@/components/PageSkeletons";
import { RutaRevealSheet } from "@/components/rutas/RutaRevealSheet";
import { BridgeSheet } from "@/components/universo/BridgeSheet";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { ChapterBar } from "@/components/tonight/ChapterBar";
import { TonightClosingEmpty } from "@/components/tonight/TonightClosingCard";
import { TonightCardMenu } from "@/components/tonight/TonightCardMenu";
import { TonightProvider, type TonightHandlers } from "@/components/tonight/TonightContext";
import { TonightEyebrow } from "@/components/tonight/TonightEyebrow";
import { WhySheet } from "@/components/tonight/WhySheet";
import { useImpressions } from "@/components/tonight/useImpressions";
import { useRecoActions } from "@/components/tonight/useRecoActions";
import { useTonightClock } from "@/components/tonight/useTonightClock";
import { useNavLabel } from "@/components/NavOriginTracker";
import { cn } from "@/lib/cn";
import { DECK_CARD_PARAM, deckCardFrom, deckIndexOf } from "@/lib/nav-origin";
import { showToast } from "@/lib/toast";
import { interleaveBySource } from "@/lib/tonight/compose";
import { closingCardFor } from "@/lib/tonight/closing-card";
import { pickRefOf } from "@/lib/tonight/reco-card";
import { rankForNow, TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
import { dayPartOf } from "@/lib/tonight/time";
import type { RutaReveal } from "@/lib/rutas/reveal";
import type { BridgeReveal } from "@/lib/universo/store";
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
  // Tonight's counters for the closing card (FIL-I21-6): this session's «Vi esto» and «Ahora no».
  const [watchedIds, setWatchedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [notTonightIds, setNotTonightIds] = useState<ReadonlySet<string>>(() => new Set());
  const [dealtTotal] = useState(() => decks.lenses.reduce((sum, lens) => sum + lens.titles.length, 0));
  const [activeSlug, setActiveSlug] = useState(
    () => decks.lenses.find((lens) => lens.slug === initialSlug)?.slug ?? decks.lenses[0]?.slug ?? "",
  );
  const activeSlugRef = useRef(activeSlug);
  // The hero's index in the whole deck: the chapter bar fills with it and counts what is left.
  const [heroIndex, setHeroIndex] = useState<number | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ index: number; seq: number }>();
  // On Back the client mounts fresh: the URL (kept by replaceState) beats the cached server props.
  const [rememberedCard] = useState(() =>
    typeof window === "undefined" ? initialCardId : (deckCardFrom(window.location.search) ?? initialCardId),
  );
  // Coming back to a card is not a new deal: no `.deck-deal` replay.
  const [dealing, setDealing] = useState(() => !rememberedCard);
  const [whyTitle, setWhyTitle] = useState<CoverflowTitle | null>(null);
  const [menuTitle, setMenuTitle] = useState<CoverflowTitle | null>(null);
  // «Vi esto» on a ruta step (FIL-I26): what flipped, shown once the server has stamped it.
  const [reveal, setReveal] = useState<RutaReveal | null>(null);
  // A bridge the film just made in «Tu universo» (FIL-I26-4, U4); ruta steps say it in their reveal.
  const [bridge, setBridge] = useState<BridgeReveal | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const impressions = useImpressions(activeSlug);
  const reco = useRecoActions();
  const recoLocal = reco.local;
  const router = useRouter();

  // Back from a ficha preview that saved a recommended film: the card learns it (FIL-I8).
  const { adoptFromFichas } = reco;
  useEffect(() => {
    adoptFromFichas(decks.lenses.flatMap((lens) => lens.titles));
  }, [adoptFromFichas, decks]);

  /** A recommended film opens its ficha (the preview until it is the user's): «opened» goes first. */
  const openReco = (title: CoverflowTitle) => {
    impressions.push(pickRefOf(title), "opened");
    impressions.flush();
    router.push(reco.hrefOf(title));
  };

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
      // Seen from its ficha while away (FIL-I8): it leaves the deck like a torn stub.
      const visible = lens.titles.filter(
        (title) => !hidden.has(title.id) && !(recoLocal[title.id]?.fromFicha && recoLocal[title.id]?.watched),
      );
      const ranked = rankForNow(visible, {
        now,
        nightEnds: decks.nightEnds,
        keepWildcardLast: lens.kind === "para-ti",
        keepPinnedFirst: lens.kind === "para-ti",
      });
      map.set(
        lens.slug,
        // Ranked by the clock, then queue and recommended alternate (the pinned one leads).
        interleaveBySource(ranked).map((card) => ({
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
            leads: card.leads,
            source: card.source,
            reco: card.reco ? { ...card.reco, saved: recoLocal[card.id]?.inWatchlist ?? false } : undefined,
            ruta: card.ruta ?? undefined,
          },
        })),
      );
    }
    return map;
  }, [decks, hidden, now, recoLocal]);

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
  const { cards, lensStarts, dealt } = useMemo(() => {
    const starts = new Map<string, number>();
    const all: CoverflowTitle[] = [];
    for (const lens of lenses) {
      starts.set(lens.slug, all.length);
      all.push(...(lensCards.get(lens.slug) ?? []));
    }
    const dealtCount = all.length;
    // One closing card after the whole deck, never per lens (FIL-I21-6).
    const last = lenses[lenses.length - 1];
    if (last) {
      all.push(closingCardFor(last.slug));
    }
    return { cards: all, lensStarts: starts, dealt: dealtCount };
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
  const addTo = (set: typeof setWatchedIds, titleId: string) => set((current) => new Set(current).add(titleId));
  const removeFrom = (set: typeof setWatchedIds, titleId: string) =>
    set((current) => {
      const next = new Set(current);
      next.delete(titleId);
      return next;
    });

  const restart = useCallback(
    () => setFocusRequest((current) => ({ index: 0, seq: (current?.seq ?? 0) + 1 })),
    [],
  );

  const handlers: TonightHandlers = {
    lens: activeLens?.slug ?? "",
    dayPart,
    now,
    closing: {
      total: dealtTotal,
      watched: watchedIds.size,
      notTonight: notTonightIds.size,
      lenses,
      onRestart: restart,
    },
    onWhy: (title) => setWhyTitle(title),
    onOpenMenu: (title) => setMenuTitle(title),
    onOpened: (title) => impressions.push(pickRefOf(title), "opened"),
    onOpenReco: openReco,
    markRecoSeen: (title, formData) => reco.markSeen(title, formData),
    onWatched: (title) => {
      impressions.push(pickRefOf(title), "watched");
      // A recommendation becomes a real title the moment it is seen: undo works on that one.
      const titleId = reco.titleIdOf(title.id) ?? title.id;
      hide(title.id);
      addTo(setWatchedIds, title.id);
      const ruta = title.tonight?.ruta;
      if (ruta) {
        void rutaAfterWatch(ruta.rutaId, title.id)
          .then((next) => setReveal(next))
          .catch(() => undefined);
      } else {
        // A recommendation's id is its catalog id; the server resolves either.
        void universoBridge(reco.titleIdOf(title.id) ?? title.id)
          .then((found) => setBridge(found))
          .catch(() => undefined);
      }
      showToast({
        title: "En tu diario",
        description: title.name,
        durationMs: 6000,
        action: {
          label: "Deshacer",
          onClick: () => {
            unhide(title.id);
            removeFrom(setWatchedIds, title.id);
            void undoMarkWatched(titleId).catch(() => {
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
    addTo(setNotTonightIds, title.id);
    showToast({ title: "Ahora no", description: `${title.name} vuelve en dos semanas.` });
    void markNotTonight(title.id, title.tonight?.lens ?? activeLens?.slug).catch(() => {
      unhide(title.id);
      removeFrom(setNotTonightIds, title.id);
      showToast({ title: "No se pudo guardar", variant: "error" });
    });
  };

  /** «No me interesa» on a recommendation: gone for good (Menos así) and Hoy learns. */
  const handleNotInterested = (title: CoverflowTitle) => {
    setMenuTitle(null);
    hide(title.id);
    showToast({ title: "No te la volveremos a sugerir", description: title.name });
    void sendTasteFeedback({ catalogId: title.id }, "less_like", title.tonight?.lens ?? activeLens?.slug).catch(() => {
      unhide(title.id);
      showToast({ title: "No se pudo guardar", variant: "error" });
    });
  };

  /** «Dejar la ruta para después»: the ruta's lens leaves Hoy; the ruta waits with no reminders. */
  const handleParkRuta = (title: CoverflowTitle) => {
    const ruta = title.tonight?.ruta;
    setMenuTitle(null);
    if (!ruta) {
      return;
    }
    hide(title.id);
    showToast({ title: "Ruta para después", description: `${ruta.title} te espera en Rutas.` });
    void parkRuta(ruta.rutaId).catch(() => {
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
    (index: number, title: CoverflowTitle) => {
      setHeroIndex(index);
      // The closing card is not a title: it settles the previous hero and logs nothing (FIL-I21-6).
      // Nor is a door card (FIL-I26-3).
      const unseen = title.closing || title.portal;
      impressions.onHeroChange(unseen ? null : pickRefOf(title));
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

  // Chapters and «quedan N» (FIL-I21-3): where the hero sits in its lens and in the night.
  const resolvedHero = heroIndex ?? deckIndexOf(cards, rememberedCard) ?? lensStarts.get(activeSlug) ?? 0;
  // On the closing card the bar reads full and nothing is left (ChapterBar clamps the position).
  const positionInLens = activeLens ? resolvedHero - (lensStarts.get(activeLens.slug) ?? 0) : 0;
  const remaining = Math.max(0, dealt - 1 - resolvedHero);
  const chapterBar =
    lenses.length > 0 && activeLens ? (
      <ChapterBar
        lenses={lenses}
        activeSlug={activeLens.slug}
        positionInLens={positionInLens}
        remaining={remaining}
        onSelect={goToLens}
      />
    ) : null;

  return (
    <TonightProvider value={handlers}>
      <div className="diario-que-ver-shell tonight-sala flex min-h-0 flex-1 flex-col gap-2 sm:gap-3 max-sm:-mt-5 max-sm:gap-1">
        {/* Desktop keeps the three rows; the phone folds the eyebrow into the rail (FIL-I21-3). */}
        <div className="shrink-0 max-sm:hidden">
          <TonightEyebrow now={now} nightEnds={decks.nightEnds} />
        </div>
        <div className="sm:hidden">
          <TonightEyebrow now={now} nightEnds={decks.nightEnds} compact />
        </div>
        {!now ? (
          <HoyDeckSkeleton />
        ) : lenses.length === 0 || !activeLens ? (
          <TonightClosingEmpty />
        ) : (
          <div className="diario-que-ver-body flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-3">
            <div className="shrink-0">
              <GenreCoverflow
                categories={lenses}
                activeSlug={activeLens.slug}
                onSelect={goToLens}
                label="Lentes de hoy"
                indicator={chapterBar}
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
          onOpenReco={(title) => {
            setMenuTitle(null);
            openReco(title);
          }}
          onSaveReco={(title) => {
            setMenuTitle(null);
            reco.add(title, "watchlist");
          }}
          onPinReco={(title) => {
            setMenuTitle(null);
            reco.pin(title);
          }}
          onNotInterested={handleNotInterested}
          onParkRuta={handleParkRuta}
          saved={menuTitle ? reco.isSaved(menuTitle.id) : false}
        />
        <RutaRevealSheet reveal={reveal} onClose={() => setReveal(null)} />
        <BridgeSheet bridge={bridge} onClose={() => setBridge(null)} />
      </div>
    </TonightProvider>
  );
};
