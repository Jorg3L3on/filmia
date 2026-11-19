"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import type { AntojoId } from "@/lib/para-ti/antojos";
import { ERAS, RUNTIMES, filtersToParams, type ParaTiFilters as Filters } from "@/lib/para-ti/rank";
import { focusRing } from "@/lib/ui";

const KINDS = [
  { value: null, label: "Ambas" },
  { value: "MOVIE", label: "Películas" },
  { value: "SERIES", label: "Series" },
] as const;

/**
 * The filters row above the shelf (FIL-I60-5): kind, era, runtime, «Solo mis plataformas». The
 * state lives in the URL with the antojo; a change replaces the entry (back still goes to the
 * opening screen) and the shelf reshuffles in place, without a reload.
 */
export const ParaTiFilters = ({ antojo, filters }: { antojo: AntojoId; filters: Filters }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (next: Filters) => {
    const query = new URLSearchParams({ antojo, ...filtersToParams(next) });
    startTransition(() => router.replace(`/para-ti?${query}`, { scroll: false }));
  };
  const onSelect = (key: "era" | "maxRuntime") => (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    go({ ...filters, [key]: value ? (key === "maxRuntime" ? Number(value) : value) : null } as Filters);
  };

  return (
    <div className="para-ti-filters" data-pending={pending || undefined} role="group" aria-label="Filtros">
      <div className="para-ti-segment" role="radiogroup" aria-label="Tipo">
        {KINDS.map((kind) => (
          <button
            key={kind.label}
            type="button"
            role="radio"
            aria-checked={filters.kind === kind.value}
            onClick={() => go({ ...filters, kind: kind.value })}
            className={cn("para-ti-segment-item", focusRing)}
          >
            {kind.label}
          </button>
        ))}
      </div>
      <label className="para-ti-select">
        <span className="sr-only">Época</span>
        <select value={filters.era ?? ""} onChange={onSelect("era")} className={focusRing}>
          <option value="">Cualquier época</option>
          {ERAS.map((era) => (
            <option key={era.id} value={era.id}>
              {era.label}
            </option>
          ))}
        </select>
      </label>
      <label className="para-ti-select">
        <span className="sr-only">Duración</span>
        <select value={filters.maxRuntime ?? ""} onChange={onSelect("maxRuntime")} className={focusRing}>
          <option value="">Cualquier duración</option>
          {RUNTIMES.map((minutes) => (
            <option key={minutes} value={minutes}>
              Hasta {minutes === 120 ? "2 h" : `${minutes} min`}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-pressed={filters.onlyMine}
        onClick={() => go({ ...filters, onlyMine: !filters.onlyMine })}
        className={cn("para-ti-toggle", focusRing)}
      >
        <span className="para-ti-toggle-dot" aria-hidden="true" />
        Solo mis plataformas
      </button>
    </div>
  );
};
