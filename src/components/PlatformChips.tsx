"use client";

import { useId } from "react";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { PLATFORM_CLASS, PLATFORM_LABEL, PLATFORMS } from "@/lib/labels";
import { focusRing } from "@/lib/ui";

const chipClass = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide press-scale transition-[transform,background-color,border-color,filter,color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
    focusRing,
    active
      ? "border-accent bg-accent text-ink"
      : "border-chrome text-fog hover:border-line-hover hover:text-paper",
  );

type PlatformChipsProps = {
  value: Platform | "";
  onChange: (next: Platform | "") => void;
  /** Rendered as a hidden input when the chips live inside a real `<form>`. */
  name?: string;
  hint?: string;
  className?: string;
};

/** «Dónde la vi»: single-select chips, `""` = Ninguna. */
export const PlatformChips = ({
  value,
  onChange,
  name,
  hint,
  className,
}: PlatformChipsProps) => {
  const hintId = useId();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-0.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fog">
          Dónde la vi
        </p>
        {hint ? (
          <p id={hintId} className="text-xs text-mist">
            {hint}
          </p>
        ) : null}
      </div>
      <div
        role="group"
        aria-label="Dónde la vi"
        aria-describedby={hint ? hintId : undefined}
        className="group flex flex-wrap gap-2"
      >
        <button
          type="button"
          aria-pressed={value === ""}
          onClick={() => onChange("")}
          className={chipClass(value === "")}
        >
          Ninguna
        </button>
        {PLATFORMS.map((item) => {
          const isCurrent = value === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={isCurrent}
              onClick={() => onChange(item)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide press-scale transition-[transform,background-color,border-color,filter,color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                focusRing,
                isCurrent
                  ? PLATFORM_CLASS[item]
                  : "border border-chrome text-fog hover:text-paper",
              )}
            >
              {PLATFORM_LABEL[item]}
            </button>
          );
        })}
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
};
