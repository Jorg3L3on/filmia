"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSearchResultFacts } from "@/app/actions/search-facts";
import {
  PENDING_FACTS,
  SEARCH_FACTS_LOOKUP_LIMIT,
  searchFactsKey,
  type SearchFactsItem,
  type SearchResultFacts,
} from "@/lib/search-result-facts";
import type { TmdbCatalogResult } from "@/lib/tmdb";

/** After the first answer, ask again for what the Catalog is still filling: twice, then give up quietly. */
const RETRY_DELAYS_MS = [2500, 5000];

const itemKey = (item: SearchFactsItem) => searchFactsKey(item.kind, item.tmdbId);

/**
 * Row A's data line for the settled results (FIL-I8-4). Known facts are kept
 * for the visit, so going back and forth between searches asks only for what
 * is new; rows hold a skeleton while their first answer is on the way.
 */
export const useSearchFacts = (results: readonly TmdbCatalogResult[]) => {
  const [facts, setFacts] = useState<Record<string, SearchResultFacts>>({});
  const [loading, setLoading] = useState<ReadonlySet<string>>(() => new Set());
  const factsRef = useRef(facts);
  useEffect(() => {
    factsRef.current = facts;
  });

  const items = useMemo(
    () =>
      results
        .slice(0, SEARCH_FACTS_LOOKUP_LIMIT)
        .map((result) => ({ tmdbId: result.tmdbId, kind: result.kind })),
    [results],
  );
  const signature = items.map(itemKey).join(",");

  useEffect(() => {
    const ask = items.filter((item) => {
      const known = factsRef.current[itemKey(item)];
      return !known || known.pending;
    });
    if (ask.length === 0) {
      return;
    }

    let cancelled = false;
    const timers: number[] = [];
    const askKeys = ask.map(itemKey);
    setLoading((current) => new Set([...current, ...askKeys]));

    const run = async (batch: SearchFactsItem[], attempt: number) => {
      let answer: Record<string, SearchResultFacts> = {};
      try {
        answer = await getSearchResultFacts(batch);
      } catch {
        answer = {};
      }
      if (cancelled) {
        return;
      }
      const last = attempt >= RETRY_DELAYS_MS.length;
      setFacts((current) => {
        const next = { ...current };
        for (const item of batch) {
          const key = itemKey(item);
          const value = answer[key];
          if (value) {
            // Out of retries: a row still filling shows what it has, without a skeleton.
            next[key] = value.pending && last ? { ...value, pending: false } : value;
          } else if (!next[key]) {
            next[key] = { ...PENDING_FACTS, pending: false };
          }
        }
        return next;
      });
      setLoading((current) => {
        const next = new Set(current);
        for (const item of batch) {
          next.delete(itemKey(item));
        }
        return next;
      });
      const stillPending = batch.filter((item) => answer[itemKey(item)]?.pending);
      if (stillPending.length > 0 && !last) {
        timers.push(window.setTimeout(() => void run(stillPending, attempt + 1), RETRY_DELAYS_MS[attempt]));
      }
    };

    void run(ask, 0);
    return () => {
      cancelled = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
    // `signature` stands for `items`: a new array with the same results is not a new search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return useCallback(
    (result: Pick<TmdbCatalogResult, "kind" | "tmdbId">): SearchResultFacts | null => {
      const key = searchFactsKey(result.kind, result.tmdbId);
      return facts[key] ?? (loading.has(key) ? PENDING_FACTS : null);
    },
    [facts, loading],
  );
};
