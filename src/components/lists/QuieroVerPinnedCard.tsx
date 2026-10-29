import Link from "next/link";
import type { PosterStackItem } from "@/components/PosterStack";
import { PosterImage } from "@/components/PosterImage";
import { ChevronIcon } from "@/components/profile/ProfileRows";
import { cn } from "@/lib/cn";
import { focusRing, glassRowClass } from "@/lib/ui";

/**
 * Quiero ver pinned at the top of Listas (FIL-34, option A): Listas took its tab, so the
 * queue opens from here. Title, count, up to four posters fanned to the right, chevron.
 */
export const QuieroVerPinnedCard = ({
  name,
  itemCount,
  posters,
}: {
  name: string;
  itemCount: number;
  posters: PosterStackItem[];
}) => {
  const countLabel = `${itemCount} ${itemCount === 1 ? "película" : "películas"}`;
  const shown = posters.slice(0, 4);

  return (
    <Link
      href="/watchlist"
      aria-label={`${name}: ${countLabel}`}
      className={cn(
        glassRowClass,
        "profile-row-press flex min-h-28 items-center gap-4 py-4 pr-3.5 pl-5 hover:bg-white/[0.06] active:bg-white/[0.08]",
        focusRing,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[1.375rem] leading-tight text-paper">{name}</span>
        <span className="mt-1 block text-sm tabular-nums text-fog">{countLabel}</span>
      </span>
      {shown.length > 0 ? (
        <span className="flex shrink-0 -space-x-6" aria-hidden="true">
          {shown.map((title, index) => (
            <span
              key={title.id}
              className="relative h-[72px] w-12 overflow-hidden rounded-lg border border-canvas bg-well shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
              style={{ zIndex: shown.length - index }}
            >
              <PosterImage name={title.name} posterPath={title.posterPath} sizes="48px" className="h-full rounded-none" ratio="fill" />
            </span>
          ))}
        </span>
      ) : null}
      <ChevronIcon className="size-5 shrink-0 text-faint" />
    </Link>
  );
};
