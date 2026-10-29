"use client";

import type { Platform } from "@/db";
import { PlatformLogo } from "@/components/PlatformLogo";
import { cn } from "@/lib/cn";
import { minePlatformsCellLabel } from "@/lib/watchlist-chips";
import { focusRing } from "@/lib/ui";
import type { WatchlistScope } from "@/lib/watchlist-query";

/** Up to four 16 px logos in the cell, then «+N». */
const MAX_LOGOS = 4;

type WatchlistScopeBarProps = {
  scope: WatchlistScope;
  counts: { all: number; mine: number };
  userPlatforms: readonly Platform[];
  /** Error state: «—» and nothing to tap. */
  disabled?: boolean;
  onChange: (scope: WatchlistScope) => void;
};

/**
 * Alcance (FIL-I34-2): Todo / Mis plataformas, each with its whole-list count. Without
 * platforms in the profile the second cell leads to «Elige tus plataformas».
 */
export const WatchlistScopeBar = ({ scope, counts, userPlatforms, disabled = false, onChange }: WatchlistScopeBarProps) => {
  const noPlatforms = userPlatforms.length === 0;
  const mineLabel = minePlatformsCellLabel(userPlatforms);
  const extra = userPlatforms.length - MAX_LOGOS;

  const cell = (id: WatchlistScope, index: number, label: string, count: string, logos: boolean) => {
    const selected = scope === id;
    const spoken = `Alcance: ${label}, ${disabled ? "sin datos" : count === "—" ? "elige tus plataformas" : `${count} títulos`}${selected ? ", seleccionado" : ""}, ${index} de 2`;
    const content = (
      <>
        <span className="qv-scope-label">{label}</span>
        <span className="qv-scope-meta" aria-hidden="true">
          {logos && !disabled ? (
            <span className="qv-scope-logos">
              {userPlatforms.slice(0, MAX_LOGOS).map((platform) => (
                <span key={platform} className="inline-flex size-4 overflow-hidden rounded-full ring-2 ring-canvas">
                  <PlatformLogo platform={platform} size={16} />
                </span>
              ))}
              {extra > 0 ? <span className="qv-scope-more">+{extra}</span> : null}
            </span>
          ) : null}
          <span className="tabular-nums">{disabled ? "—" : count}</span>
        </span>
      </>
    );
    const className = cn("qv-scope-cell press-scale", focusRing, selected && "is-selected");
    // No platforms yet: the cell stays and selecting it shows «Elige tus plataformas».
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={spoken}
        disabled={disabled}
        onClick={() => onChange(id)}
        className={className}
      >
        {content}
      </button>
    );
  };

  return (
    <div className={cn("qv-scope", disabled && "is-disabled")} role="radiogroup" aria-label="Alcance">
      {cell("all", 1, "Todo", String(counts.all), false)}
      {cell("mine", 2, mineLabel, noPlatforms ? "—" : String(counts.mine), !noPlatforms)}
    </div>
  );
};
