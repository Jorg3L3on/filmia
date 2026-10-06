"use client";

import { PlatformLogo } from "@/components/PlatformLogo";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL, PLATFORMS } from "@/lib/labels";
import { staggerStyle } from "@/lib/motion-style";
import { focusRing } from "@/lib/ui";

type PlatformToggleGridProps = {
  value: readonly Platform[];
  onToggle: (platform: Platform) => void;
  disabled?: boolean;
  /** Bienvenida: tiles deal in with a stagger and read larger. */
  variant?: "compact" | "roomy";
  legend?: string;
};

/** Presentational toggle grid shared by Perfil («Plataformas MX») and the Bienvenida. */
export const PlatformToggleGrid = ({
  value,
  onToggle,
  disabled = false,
  variant = "compact",
  legend = "Plataformas de streaming en México",
}: PlatformToggleGridProps) => (
  <fieldset>
    <legend className="sr-only">{legend}</legend>
    <ul className={cn("grid gap-1.5", variant === "roomy" ? "grid-cols-2 gap-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}>
      {PLATFORMS.map((platform, index) => {
        const isSelected = value.includes(platform);
        return (
          <li
            key={platform}
            className={cn("group", variant === "roomy" && "stagger-in")}
            style={variant === "roomy" ? staggerStyle(index, 35) : undefined}
          >
            <button
              type="button"
              onClick={() => onToggle(platform)}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={
                isSelected
                  ? `Quitar ${PLATFORM_SERVICE_LABEL[platform]}`
                  : `Añadir ${PLATFORM_SERVICE_LABEL[platform]}`
              }
              className={cn(
                "press-scale flex w-full cursor-pointer items-center gap-2 rounded-xl border text-left text-sm",
                variant === "roomy" ? "px-3 py-3" : "px-2.5 py-2",
                "transition-[color,background-color,border-color,transform,box-shadow] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                focusRing,
                isSelected
                  ? "border-accent bg-accent/15 text-paper shadow-[0_0_0_1px_rgb(var(--accent-rgb)/0.35),0_10px_30px_-18px_rgb(var(--accent-rgb)/0.9)]"
                  : "border-chrome bg-well text-fog hover:border-line hover:text-paper group-hover:text-paper",
              )}
            >
              <PlatformLogo platform={platform} size={variant === "roomy" ? 24 : 20} />
              <span className="min-w-0 flex-1 truncate">{PLATFORM_SERVICE_LABEL[platform]}</span>
              {variant === "roomy" ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition-[background-color,border-color,color] duration-[var(--duration-tab)]",
                    isSelected ? "border-accent bg-accent text-ink" : "border-chrome text-transparent",
                  )}
                >
                  ✓
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  </fieldset>
);
