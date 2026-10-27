"use client";

import { useMemo } from "react";
import { getFilmographyFacts } from "@/app/actions/search-facts";
import { useSearchFacts } from "@/components/tmdb-search/useSearchFacts";
import type { PersonFilmography } from "@/lib/person-filmography";
import { FILMOGRAPHY_FACTS_LIMIT } from "@/lib/search-result-facts";

/** The IMDb line at 2.5 s (FIL-I22-4); a big filmography's MX availability gets one more look (FIL-I30-1). */
const FILMOGRAPHY_RETRY_DELAYS_MS = [2500, 3500];

/**
 * FIL-I16-1: the person on screen asks the Catalog about its whole work; the
 * best-known titles go first, so OMDb's few calls per visit land where they
 * count. The person rides along so the server seeds unknown titles from their
 * (cached) credits (FIL-I30-1).
 */
export const useFilmographyFacts = (shownPerson: PersonFilmography | null) => {
  const items = useMemo(
    () => (shownPerson ? [...shownPerson.entries].sort((a, b) => b.votes - a.votes) : []),
    [shownPerson],
  );
  const person = shownPerson ? { id: shownPerson.person.id, role: shownPerson.role } : undefined;
  return useSearchFacts(items, {
    load: (batch) => getFilmographyFacts(batch, person),
    limit: FILMOGRAPHY_FACTS_LIMIT,
    retryDelaysMs: FILMOGRAPHY_RETRY_DELAYS_MS,
  });
};
