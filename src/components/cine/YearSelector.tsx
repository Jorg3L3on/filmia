"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRailFade } from "@/components/cine/useRailFade";
import { topYearOptions } from "@/lib/cine-top";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/**
 * Year chips (FIL-I23-1): the active one is centred when the rail mounts or the year changes
 * (no animation), both edges fade when there is more, and each 36 px chip has a 44 px hit zone.
 * `hrefTemplate` keeps the page (Cine or the full top): `{year}` is replaced.
 */
export const YearSelector = ({ year, today, hrefTemplate }: { year: number; today: string; hrefTemplate: string }) => {
  const railRef = useRef<HTMLElement>(null);
  useRailFade(railRef);

  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!rail || !active) {
      return;
    }
    rail.scrollLeft = active.offsetLeft + active.offsetWidth / 2 - rail.clientWidth / 2;
  }, [year]);

  return (
    <nav ref={railRef} aria-label="Año" className="rail cine-fade relative -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      {topYearOptions(today).map((option) => (
        <Link
          key={option}
          href={hrefTemplate.replace("{year}", String(option))}
          scroll={false}
          aria-current={option === year ? "page" : undefined}
          className={cn(
            "relative inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm tabular-nums transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
            option === year ? "bg-cine font-semibold text-ink" : "bg-white/[0.06] text-fog hover:text-paper",
            focusRing,
          )}
        >
          {option}
        </Link>
      ))}
    </nav>
  );
};
