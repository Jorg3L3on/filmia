"use client";

import { useEffect, useState, useTransition } from "react";
import { loadPersonFilmography } from "@/app/actions/metadata";
import type { PersonViewState } from "@/components/tmdb-search/PersonSearch";
import type { PersonRole } from "@/lib/person-filmography";

const cache = new Map<string, PersonViewState>();

/**
 * Client-side filmography for the Director chip's clear match (the URL stays
 * `?q=…&tipo=director`). Cached per person and role for the session.
 */
export const usePersonFilmography = (
  person: { id: number; name: string } | null,
  role: PersonRole = "director",
) => {
  const personId = person?.id ?? null;
  const personName = person?.name ?? "";
  const key = personId ? `${personId}:${role}` : null;
  const [state, setState] = useState<{ key: string; value: PersonViewState } | null>(null);
  const [, startLoad] = useTransition();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!personId || !key || cache.has(key)) {
      return;
    }
    let cancelled = false;
    startLoad(async () => {
      const outcome = await loadPersonFilmography(personId, role);
      const value: PersonViewState = outcome.ok
        ? { kind: "ready", data: outcome.data }
        : { kind: "error", error: outcome.error, personId, role, name: personName };
      if (outcome.ok) {
        cache.set(key, value);
      }
      if (!cancelled) {
        setState({ key, value });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, key, personId, personName, role]);

  const value = key ? (cache.get(key) ?? (state?.key === key ? state.value : null)) : null;
  return { state: value, retry: () => setAttempt((n) => n + 1) };
};
