import { PlatformLogo } from "@/components/PlatformLogo";
import { cn } from "@/lib/cn";
import { PLATFORM_LABEL } from "@/lib/labels";
import type { Platform } from "@/db";
import { focusRing } from "@/lib/ui";
import type { ReactNode } from "react";

export const catalogBarChipClass = (selected: boolean) =>
  cn(
    "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium tab-transition",
    focusRing,
    selected
      ? "bg-accent text-ink"
      : "bg-well text-paper hover:bg-chrome",
  );

export const catalogSheetChipClass = (selected: boolean) =>
  cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
    focusRing,
    selected
      ? "border-accent bg-accent/10 text-accent"
      : "border-chrome bg-well text-fog hover:border-line-hover hover:text-paper",
  );

export const CatalogSheetSection = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="space-y-3">
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        {title}
      </p>
      {hint ? <p className="text-sm text-fog">{hint}</p> : null}
    </div>
    {children}
  </div>
);

export const CatalogPlatformChipList = ({
  platforms,
  selected,
  onToggle,
}: {
  platforms: Platform[];
  selected: Platform[];
  onToggle: (platform: Platform) => void;
}) => (
  <ul className="flex flex-wrap gap-2">
    {platforms.map((platform) => {
      const isSelected = selected.includes(platform);
      return (
        <li key={platform}>
          <button
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(platform)}
            className={catalogSheetChipClass(isSelected)}
          >
            <PlatformLogo platform={platform} size={18} />
            {PLATFORM_LABEL[platform]}
          </button>
        </li>
      );
    })}
  </ul>
);

export const CatalogFilmIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="4" y="6" width="16" height="12" rx="1.5" />
    <path strokeLinecap="round" d="M8 6v12M16 6v12M4 10h4M16 10h4M4 14h4M16 14h4" />
  </svg>
);

export const CatalogTvIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="4" y="7" width="16" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M8 20h8M12 7 9.5 4.5M12 7l2.5-2.5" />
  </svg>
);

export const CatalogOrderIcon = ({ name }: { name: "clock" | "star" | "az" }) => {
  if (name === "star") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinejoin="round" d="m12 4.5 2.1 4.4 4.8.6-3.5 3.3.9 4.8L12 15.4 7.7 17.6l.9-4.8-3.5-3.3 4.8-.6Z" />
      </svg>
    );
  }

  if (name === "az") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" d="M7 7h6M8.5 7 12 17M10 13h5M17 7v10M17 17l-2-2M17 17l2-2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="12" cy="12" r="7.25" />
      <path strokeLinecap="round" d="M12 8.5V12l2.5 2" />
    </svg>
  );
};
