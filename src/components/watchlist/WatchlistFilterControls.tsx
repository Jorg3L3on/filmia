"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/** Building blocks of the Quiero ver Filtros sheet (FIL-I34-4): 40 px chips, 31 px switches, sections. */

export const FilterSection = ({
  title,
  aside,
  badge,
  children,
}: {
  title: string;
  /** Right side of the heading: «3 de 14», «2 elegidos», «hasta 1 h 40 min». */
  aside?: string | null;
  /** «Datos parciales». */
  badge?: string;
  children: ReactNode;
}) => {
  const headingId = useId();
  return (
    <section className="space-y-3 border-b border-white/[0.07] pb-5 last:border-b-0" aria-labelledby={headingId}>
      <div className="flex items-center gap-2">
        <h3 id={headingId} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">
          {title}
        </h3>
        {badge ? <span className="qv-tag">{badge}</span> : null}
        {aside ? <span className="ml-auto text-xs font-semibold tabular-nums text-paper">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
};

type FilterChipProps = {
  selected: boolean;
  count?: number;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
};

/** 40 px chip, 44 px touch; the count rides along and a 0 dims it (still tappable when on). */
export const FilterChip = ({ selected, count, disabled, onClick, children, label }: FilterChipProps) => {
  const inert = !selected && count === 0;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled || inert}
      onClick={onClick}
      className={cn("qv-sheet-chip press-scale", focusRing, selected && "is-on", inert && "is-empty")}
    >
      {children}
      {count != null ? <span className="qv-sheet-chip-count">{count}</span> : null}
    </button>
  );
};

export const ChipWrap = ({ children, label }: { children: ReactNode; label?: string }) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
    {children}
  </div>
);

type SegmentedOption<T extends string> = { id: T; label: string };

/** Two or three cells (Tipo; Suscripción / Alquiler o compra). */
export const FilterSegmented = <T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  label: string;
  onChange: (value: T) => void;
}) => (
  <div className="qv-segmented" role="radiogroup" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.id}
        type="button"
        role="radio"
        aria-checked={value === option.id}
        onClick={() => onChange(option.id)}
        className={cn("qv-segmented-cell press-scale", focusRing, value === option.id && "is-selected")}
      >
        {option.label}
      </button>
    ))}
  </div>
);

/** A 44 px row with a label, a help line and a switch. */
export const FilterSwitchRow = ({
  label,
  hint,
  checked,
  count,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  count?: number;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl text-left", focusRing)}
  >
    <span className="min-w-0 flex-1">
      <span className="block text-[0.90625rem] text-paper">
        {label}
        {count != null ? <span className="ml-1.5 text-xs tabular-nums text-mist">{count}</span> : null}
      </span>
      <span className="block text-xs text-mist">{hint}</span>
    </span>
    <span className={cn("qv-switch", checked && "is-on")} aria-hidden="true" />
  </button>
);

type RangeSliderProps = {
  label: string;
  min: number;
  max: number;
  step?: number;
  /** One thumb (`[null, hi]`) or two. */
  value: [number | null, number];
  ticks: { value: number; label: string }[];
  format: (value: number) => string;
  onChange: (value: [number | null, number]) => void;
};

/** Native range inputs over one track: keyboard, VoiceOver and touch come for free. */
export const RangeSlider = ({ label, min, max, step = 1, value, ticks, format, onChange }: RangeSliderProps) => {
  const [low, high] = value;
  const pct = (input: number) => ((input - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5" data-no-sheet-drag>
      <div className="qv-range" style={{ ["--lo" as string]: `${pct(low ?? min)}%`, ["--hi" as string]: `${pct(high)}%` }}>
        {low != null ? (
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={low}
            aria-label={`${label}: desde`}
            aria-valuetext={format(low)}
            onChange={(event) => onChange([Math.min(Number(event.target.value), high), high])}
          />
        ) : null}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          aria-label={low != null ? `${label}: hasta` : label}
          aria-valuetext={format(high)}
          onChange={(event) => onChange([low, Math.max(Number(event.target.value), low ?? min)])}
        />
      </div>
      <div className="relative h-4 text-[11px] text-mist" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick.value} className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums first:translate-x-0 last:-translate-x-full" style={{ left: `${pct(tick.value)}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
};
