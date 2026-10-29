"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { universoBridge } from "@/app/actions/universo";
import { markNotTonight, sendTasteFeedback, undoNotInterested, undoNotTonight } from "@/app/actions/tonight";
import { removeFromWatchlist, undoMarkWatched } from "@/app/actions/watchlist";
import { CoverflowDeck } from "@/components/CoverflowDeck";
import { GenreCoverflow } from "@/components/GenreCoverflow";
import { HoyDeckSkeleton } from "@/components/PageSkeletons";
import { BridgeSheet } from "@/components/universo/BridgeSheet";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { ChapterBar } from "@/components/tonight/ChapterBar";
import { TonightClosingEmpty } from "@/components/tonight/TonightClosingCard";
import { TonightCardMenu } from "@/components/tonight/TonightCardMenu";
import { TonightProvider, type TonightHandlers } from "@/components/tonight/TonightContext";
import { TonightEyebrow } from "@/components/tonight/TonightEyebrow";
import { TonightFilters } from "@/components/tonight/TonightFilters";
import { WhySheet } from "@/components/tonight/WhySheet";
import { useImpressions } from "@/components/tonight/useImpressions";
import { useRecoActions } from "@/components/tonight/useRecoActions";
import { useTonightClock } from "@/components/tonight/useTonightClock";
import { useNavLabel } from "@/components/NavOriginTracker";
import { catalogBarButtonClass } from "@/components/catalog-filters/filter-ui";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { DECK_CARD_PARAM, deckCardFrom, deckIndexOf } from "@/lib/nav-origin";
import { reportPickFailure, startWatchedUndo } from "@/lib/alert-retry";
import { showToast } from "@/lib/toast";
import { retryAfterRevert, showActionError, TOAST_COPY, toastPoster } from "@/lib/toast-alerts";
import { interleaveBySource } from "@/lib/tonight/compose";
import {
  moodById,
  NO_LIMIT_ID,
  pickOptions,
  TIME_BUDGETS,
  TONIGHT_BUDGET_PARAM,
  TONIGHT_MOOD_PARAM,
  widerBudget,
} from "@/lib/tonight/budget";
import { closingCardFor, tallyCount } from "@/lib/tonight/closing-card";
import { pickRefOf } from "@/lib/tonight/reco-card";
import { rankForNow, TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
import { dayPartOf } from "@/lib/tonight/time";
import type { BridgeReveal } from "@/lib/universo/store";
import type { TonightDecks } from "@/lib/tonight-store";
import { showDiaryToast } from "@/lib/quick-rate-toast";

const DEAL_MS = 700;

const OPTIONS_HEADING = ["", "Una opción para esta noche", "Dos opciones para esta noche", "Tres opciones para esta noche"];

type TonightFilterState = { budgetId: string; moodId: string | null };

const NO_FILTERS: TonightFilterState = { budgetId: NO_LIMIT_ID, moodId: null };

/** `?tengo=` and `?animo=`: the filters survive a trip to a ficha and back (a new night opens without them). */
const filtersFrom = (search: string): TonightFilterState => {
  const params = new URLSearchParams(search);
  const budgetId = params.get(TONIGHT_BUDGET_PARAM);
  return {
    budgetId: TIME_BUDGETS.some((budget) => budget.id === budgetId) ? (budgetId as string) : NO_LIMIT_ID,
    moodId: moodById(params.get(TONIGHT_MOOD_PARAM))?.id ?? null,
  };
};

/** Writes the filters into `params`, dropping the ones at their default. */
const writeFilters = (params: URLSearchParams, filters: TonightFilterState) => {
  if (filters.budgetId === NO_LIMIT_ID) {
    params.delete(TONIGHT_BUDGET_PARAM);
  } else {
    params.set(TONIGHT_BUDGET_PARAM, filters.budgetId);
  }
  if (filters.moodId) {
    params.set(TONIGHT_MOOD_PARAM, filters.moodId);
  } else {
    params.delete(TONIGHT_MOOD_PARAM);
  }
  return params;
};
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
  // «Ánimo» (FIL-I31-2). Client-only like the card: the chips render once the clock has mounted.
  const [filters, setFilters] = useState(() =>
    typeof window === "undefined" ? NO_FILTERS : filtersFrom(window.location.search),
  );
  const filtersRef = useRef(filters);
  // The hero across both decks, so leaving the three options lands back on the film being looked at.
  const heroIdRef = useRef<string | null>(null);
  const [returnCard, setReturnCard] = useState<string | null>(null);
  const [whyTitle, setWhyTitle] = useState<CoverflowTitle | null>(null);
  const [menuTitle, setMenuTitle] = useState<CoverflowTitle | null>(null);
  // A bridge the film just made in «Tu universo» (FIL-I26-4, U4).
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
      watched: tallyCount(decks.tally.watched, watchedIds),
      notTonight: tallyCount(decks.tally.notTonight, notTonightIds),
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
      // A recommendation's id is its catalog id; the server resolves either.
      void universoBridge(reco.titleIdOf(title.id) ?? title.id)
        .then((found) => setBridge(found))
        .catch(() => undefined);
      const poster = toastPoster(title.posterPath);
      showDiaryToast({
        titleId,
        description: title.name,
        poster,
        // Hoy's `rating` already folds in an implied one: any rating hides the quick answer.
        rated: title.rating != null,
        onUndo: () => {
          startWatchedUndo({
            apply: () => {
              unhide(title.id);
              removeFrom(setWatchedIds, title.id);
            },
            revert: () => {
              hide(title.id);
              addTo(setWatchedIds, title.id);
            },
            undo: () => undoMarkWatched(titleId),
            poster,
            description: title.name,
          });
        },
      });
    },
    onWatchError: (title, message) => {
      unhide(title.id);
      // The message is already a string. The save and its form are not here, so this cannot be retried.
      showActionError({
        title: TOAST_COPY.couldNotSave,
        description: message,
        poster: toastPoster(title.posterPath),
      });
    },
  };

  const handleNotTonight = (title: CoverflowTitle) => {
    setMenuTitle(null);
    hide(title.id);
    addTo(setNotTonightIds, title.id);
    const poster = toastPoster(title.posterPath);
    const saved = markNotTonight(title.id, title.tonight?.lens ?? activeLens?.slug).then(
      () => true,
      () => {
        unhide(title.id);
        removeFrom(setNotTonightIds, title.id);
        reportPickFailure(poster);
        return false;
      },
    );
    showToast({
      title: TOAST_COPY.notTonight,
      description: `${title.name} vuelve en dos semanas.`,
      poster,
      action: {
        label: "Deshacer",
        onClick: () => {
          unhide(title.id);
          removeFrom(setNotTonightIds, title.id);
          // After the save lands, so a quick tap never leaves the skip behind.
          void saved.then((ok) => (ok ? undoNotTonight(title.id) : undefined)).catch(() => {
            hide(title.id);
            addTo(setNotTonightIds, title.id);
            showActionError({ title: TOAST_COPY.couldNotUndo, poster });
          });
        },
      },
    });
  };

  /** «No me interesa» on a recommendation: gone for good (Menos así) and Hoy learns. Deshacer brings it back. */
  const handleNotInterested = (title: CoverflowTitle) => {
    setMenuTitle(null);
    hide(title.id);
    const poster = toastPoster(title.posterPath);
    const saved = sendTasteFeedback({ catalogId: title.id }, "less_like", title.tonight?.lens ?? activeLens?.slug).then(
      () => true,
      () => {
        unhide(title.id);
        // A taste signal is not idempotent: a timeout may already have counted.
        showActionError({
          title: TOAST_COPY.couldNotSave,
          poster,
        });
        return false;
      },
    );
    showToast({
      title: TOAST_COPY.neverSuggest,
      description: title.name,
      poster,
      action: {
        label: "Deshacer",
        onClick: () => {
          unhide(title.id);
          void saved.then((ok) => (ok ? undoNotInterested({ catalogId: title.id }) : undefined)).catch(() => {
            showActionError({ title: TOAST_COPY.couldNotUndo, poster });
          });
        },
      },
    });
  };

  const handleRemove = (title: CoverflowTitle) => {
    setMenuTitle(null);
    const poster = toastPoster(title.posterPath);
    hide(title.id);
    showToast({ title: TOAST_COPY.removedWatchlist, description: title.name, poster });
    void removeFromWatchlist(title.id).catch(() => {
      unhide(title.id);
      showActionError({
        title: TOAST_COPY.couldNotRemove,
        poster,
        retry: () =>
          retryAfterRevert(
            () => hide(title.id),
            () => unhide(title.id),
            async () => {
              await removeFromWatchlist(title.id);
              showToast({ title: TOAST_COPY.removedWatchlist, description: title.name, poster });
            },
          ),
      });
    });
  };

  // The hero's own lens drives the rail; lens + card live in the URL (impressions settle the previous hero first).
  const syncHero = useCallback(
    (title: CoverflowTitle) => {
      // The closing card is not a title: it settles the previous hero and logs nothing (FIL-I21-6).
      // Nor is a door card (FIL-I26-3).
      const unseen = title.closing || title.portal;
      impressions.onHeroChange(unseen ? null : pickRefOf(title));
      const slug = title.tonight?.lens;
      if (!slug) {
        return;
      }
      heroIdRef.current = title.id;
      const params = writeFilters(
        new URLSearchParams({ [TONIGHT_LENS_PARAM]: slug, [DECK_CARD_PARAM]: title.id }),
        filtersRef.current,
      );
      // Shallow URL sync: router.replace would refetch the server page mid-swipe.
      window.history.replaceState(null, "", `/?${params}`);
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

  const handleActiveChange = useCallback(
    (index: number, title: CoverflowTitle) => {
      setHeroIndex(index);
      syncHero(title);
    },
    [syncHero],
  );

  // Only the full deck moves the chapter bar; the three options are not chapters.
  const handleOptionChange = useCallback((_index: number, title: CoverflowTitle) => syncHero(title), [syncHero]);

  const budget = TIME_BUDGETS.find((item) => item.id === filters.budgetId) ?? TIME_BUDGETS[TIME_BUDGETS.length - 1];
  const mood = moodById(filters.moodId);
  const options = useMemo(
    () =>
      budget.maxRuntimeMin == null && !mood
        ? null
        : pickOptions(
            // Films only: the closing card and door cards have no runtime and are not options.
            cards.filter((card) => !card.closing && !card.portal),
            { maxRuntimeMin: budget.maxRuntimeMin, genres: mood?.genres },
            (card) => card.tonight?.runtimeMinutes,
          ),
    [budget.maxRuntimeMin, cards, mood],
  );
  const wider = budget.maxRuntimeMin == null ? null : widerBudget(budget.id);

  const applyFilters = (next: Partial<TonightFilterState>) => {
    const merged = { ...filtersRef.current, ...next };
    filtersRef.current = merged;
    setFilters(merged);
    setReturnCard(heroIdRef.current);
    const query = writeFilters(new URLSearchParams(window.location.search), merged).toString();
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  };
  const chooseBudget = (budgetId: string) => applyFilters({ budgetId });
  const chooseMood = (moodId: string | null) => applyFilters({ moodId });

  // «Sin resultados» says which filter left the deck empty.
  const emptyMessage = !mood
    ? `Nada de lo de hoy dura ${budget.label} o menos.`
    : budget.maxRuntimeMin == null
      ? `Hoy no hay nada para «${mood.label}».`
      : `Nada para «${mood.label}» en ${budget.label} o menos.`;

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
        <div className="tonight-eyebrow-row shrink-0 max-sm:hidden">
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
            <TonightFilters
              moodId={mood?.id ?? null}
              onMood={chooseMood}
              className="shrink-0 px-1"
            />
            {options ? (
              <>
                <h2 className="shrink-0 px-1 text-sm font-medium text-paper">
                  {OPTIONS_HEADING[options.cards.length] || "Sin resultados"}
                </h2>
                {options.cards.length > 0 ? (
                  <CoverflowDeck
                    key={`options-${budget.id}-${mood?.id ?? ""}`}
                    titles={options.cards}
                    footer="tonight"
                    className="min-h-0 flex-1"
                    onActiveChange={handleOptionChange}
                  />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-sm text-fog">{emptyMessage}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {wider ? (
                        <button
                          type="button"
                          onClick={() => chooseBudget(wider.id)}
                          className={catalogBarButtonClass}
                        >
                          {wider.maxRuntimeMin == null ? "Sin límite" : `Probar con ${wider.label}`}
                        </button>
                      ) : null}
                      {mood ? (
                        <button type="button" onClick={() => chooseMood(null)} className={catalogBarButtonClass}>
                          Quitar ánimo
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
                {options.unknownRuntime > 0 ? (
                  <p className="flex shrink-0 items-center justify-center gap-2 px-1 text-xs text-fog">
                    <span>
                      Sin duración conocida: {options.unknownRuntime}{" "}
                      {options.unknownRuntime === 1 ? "título oculto" : "títulos ocultos"}
                    </span>
                    <button
                      type="button"
                      onClick={() => chooseBudget(NO_LIMIT_ID)}
                      className={cn("rail-chip rounded-full px-2 font-medium text-paper underline-offset-2 hover:underline", focusRing)}
                    >
                      Mostrar todo
                    </button>
                  </p>
                ) : null}
              </>
            ) : (
              <>
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
                    // Read on mount only: the last hero (back from the options), the remembered card, else the ?lente= chapter, else the top.
                    initialIndex={
                      deckIndexOf(cards, returnCard) ?? deckIndexOf(cards, rememberedCard) ?? lensStarts.get(activeSlug) ?? 0
                    }
                    focusRequest={focusRequest}
                    onActiveChange={handleActiveChange}
                  />
                </div>
              </>
            )}
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
          saved={menuTitle ? reco.isSaved(menuTitle.id) : false}
        />
        <BridgeSheet bridge={bridge} onClose={() => setBridge(null)} />
      </div>
    </TonightProvider>
  );
};
