"use client";

import { useState } from "react";
import type { Platform } from "@/db";
import { PlatformLogo } from "@/components/PlatformLogo";
import {
  ChipWrap,
  FilterChip,
  FilterSection,
  FilterSegmented,
  RangeSlider,
} from "@/components/watchlist/WatchlistFilterControls";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL, PLATFORMS } from "@/lib/labels";
import { SERIES_STATUS_FILTER_OPTIONS } from "@/lib/series";
import { focusRing } from "@/lib/ui";
import { durationLabel, yearsLabel } from "@/lib/watchlist-chips";
import { platformFacet, toggleValue, type WatchlistCounter } from "@/lib/watchlist-facets";
import type { NumberRange, WatchlistQuery } from "@/lib/watchlist-query";

/** Filtros sheet, first half (FIL-I34-4): Tipo, Dónde verla, Duración, Año. */

export type SectionProps = {
  draft: WatchlistQuery;
  count: WatchlistCounter;
  onChange: (next: WatchlistQuery) => void;
};

export const KindSection = ({ draft, count, onChange }: SectionProps) => (
  <FilterSection title="Tipo">
    <FilterSegmented
      label="Tipo"
      value={draft.kind}
      options={[
        { id: "ALL", label: "Todo" },
        { id: "MOVIE", label: `Películas · ${count({ ...draft, kind: "MOVIE", seriesStatus: null })}` },
        { id: "SERIES", label: `Series · ${count({ ...draft, kind: "SERIES" })}` },
      ]}
      onChange={(kind) => onChange({ ...draft, kind, seriesStatus: kind === "MOVIE" ? null : draft.seriesStatus })}
    />
    {draft.kind === "SERIES" || draft.seriesStatus ? (
      <ChipWrap label="Estado de la serie">
        {SERIES_STATUS_FILTER_OPTIONS.map((option) => (
          <FilterChip
            key={option.id}
            selected={draft.seriesStatus === option.id}
            count={count({ ...draft, kind: "SERIES", seriesStatus: option.id })}
            onClick={() =>
              onChange({ ...draft, kind: "SERIES", seriesStatus: draft.seriesStatus === option.id ? null : option.id })
            }
          >
            {option.label}
          </FilterChip>
        ))}
      </ChipWrap>
    ) : null}
  </FilterSection>
);

/** Tiles shown before «Ver las N». */
const FIRST_TILES = 7;

export const PlatformsSection = ({
  draft,
  count,
  onChange,
  userPlatforms,
}: SectionProps & { userPlatforms: readonly Platform[] }) => {
  const [expanded, setExpanded] = useState(false);
  const every = platformFacet(draft, count, { userPlatforms, all: PLATFORMS, includeEmpty: true });
  const useful = every.filter((entry) => entry.mine || entry.count > 0 || draft.platforms.includes(entry.platform));
  const listed = expanded ? every : useful.slice(0, FIRST_TILES);
  const withTitles = every.filter((entry) => entry.count > 0).length;
  const toggle = (platform: Platform) => onChange({ ...draft, platforms: toggleValue(draft.platforms, platform) });

  return (
    <FilterSection title="Dónde verla" aside={`${withTitles} de ${PLATFORMS.length}`}>
      <FilterSegmented
        label="Cómo verla"
        value={draft.access}
        options={[
          { id: "flatrate", label: "Suscripción" },
          { id: "rent", label: "Alquiler o compra" },
        ]}
        onChange={(access) => onChange({ ...draft, access })}
      />
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Plataformas">
        {listed.map((entry) => {
          const selected = draft.platforms.includes(entry.platform);
          const inert = !selected && entry.count === 0;
          const name = PLATFORM_SERVICE_LABEL[entry.platform];
          return (
            <button
              key={entry.platform}
              type="button"
              aria-pressed={selected}
              disabled={inert}
              aria-label={`${name}${entry.mine ? ", tuya" : ""}, ${entry.count} ${entry.count === 1 ? "título" : "títulos"}`}
              onClick={() => toggle(entry.platform)}
              className={cn("qv-tile press-scale", focusRing, selected && "is-on", inert && "is-empty")}
            >
              {entry.mine ? <span className="qv-tile-mine">Tuya</span> : null}
              <PlatformLogo platform={entry.platform} size={26} className="rounded-full" />
              <span className="w-full truncate text-[11px] text-paper">{name}</span>
              <span className="text-[10.5px] tabular-nums text-mist">{entry.count}</span>
            </button>
          );
        })}
        {every.length > listed.length || expanded ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className={cn("qv-tile is-link press-scale", focusRing)}
          >
            {expanded ? "Ver menos" : `Ver las ${every.length}`}
          </button>
        ) : null}
      </div>
    </FilterSection>
  );
};

/** The duration slider runs to 3 h; the end means «3 h o más». */
const DURATION_MAX = 180;
const DURATION_BUCKETS: { label: string; range: NumberRange }[] = [
  { label: "100–150", range: { min: 100, max: 150 } },
  { label: "+150", range: { min: 150, max: null } },
];

const sameRange = (left: NumberRange | null, right: NumberRange) =>
  left?.min === right.min && left?.max === right.max;

export const DurationSection = ({ draft, count, onChange, missingRuntime }: SectionProps & { missingRuntime: number }) => {
  const high = draft.duration?.max ?? DURATION_MAX;
  return (
    <FilterSection title="Duración" aside={draft.duration ? durationLabel(draft.duration) : null}>
      <RangeSlider
        label="Duración máxima"
        min={0}
        max={DURATION_MAX}
        step={5}
        value={[null, high]}
        ticks={[
          { value: 0, label: "0" },
          { value: 60, label: "1 h" },
          { value: 120, label: "2 h" },
          { value: 180, label: "3 h+" },
        ]}
        format={(value) => (value >= DURATION_MAX ? "Sin límite" : durationLabel({ min: null, max: value }))}
        onChange={([, max]) => {
          const min = draft.duration?.min ?? null;
          const next = max >= DURATION_MAX ? (min == null ? null : { min, max: null }) : { min, max };
          onChange({ ...draft, duration: next });
        }}
      />
      <ChipWrap label="Atajos de duración">
        <FilterChip selected={draft.short} count={count({ ...draft, short: true })} onClick={() => onChange({ ...draft, short: !draft.short })}>
          Cortas &lt; 100 min
        </FilterChip>
        {DURATION_BUCKETS.map((bucket) => {
          const selected = sameRange(draft.duration, bucket.range);
          return (
            <FilterChip
              key={bucket.label}
              selected={selected}
              count={count({ ...draft, duration: bucket.range })}
              onClick={() => onChange({ ...draft, duration: selected ? null : bucket.range })}
            >
              {bucket.label}
            </FilterChip>
          );
        })}
      </ChipWrap>
      <p className="text-xs text-mist">
        Las series cuentan por capítulo.
        {missingRuntime > 0
          ? ` ${missingRuntime} ${missingRuntime === 1 ? "título aún no tiene" : "títulos aún no tienen"} duración y no ${missingRuntime === 1 ? "entra" : "entran"} en este filtro.`
          : null}
      </p>
    </FilterSection>
  );
};

export const YearSection = ({
  draft,
  count,
  onChange,
  decades,
  bounds,
}: SectionProps & { decades: number[]; bounds: { min: number; max: number } }) => {
  const low = draft.years?.min ?? bounds.min;
  const high = draft.years?.max ?? bounds.max;
  const setRange = (min: number, max: number) =>
    onChange({ ...draft, years: min <= bounds.min && max >= bounds.max ? null : { min: min <= bounds.min ? null : min, max: max >= bounds.max ? null : max } });

  return (
    <FilterSection title="Año" aside={draft.years ? yearsLabel(draft.years) : null}>
      <RangeSlider
        label="Año"
        min={bounds.min}
        max={bounds.max}
        value={[low, high]}
        ticks={[bounds.min, Math.round((bounds.min * 2 + bounds.max) / 3), Math.round((bounds.min + bounds.max * 2) / 3), bounds.max].map((value) => ({ value, label: String(value) }))}
        format={String}
        onChange={([min, max]) => setRange(min ?? bounds.min, max)}
      />
      <ChipWrap label="Décadas">
        {decades.map((decade) => {
          const range = { min: decade, max: decade + 9 };
          const selected = sameRange(draft.years, range);
          return (
            <FilterChip
              key={decade}
              selected={selected}
              count={count({ ...draft, years: range })}
              onClick={() => onChange({ ...draft, years: selected ? null : range })}
            >
              {decade}s
            </FilterChip>
          );
        })}
      </ChipWrap>
    </FilterSection>
  );
};
