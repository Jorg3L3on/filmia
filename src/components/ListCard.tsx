import Link from "next/link";
import type { ReactNode } from "react";
import { collectionCountLabel } from "@/lib/labels";
import { PosterStack, type PosterStackItem } from "@/components/PosterStack";
import { FanOnView } from "@/components/lists/FanOnView";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/** Wrapping 3-up grid for `layout="grid"` cards (Personalizadas). */
/** Phone: three columns. From sm, as many 124 px cards as fit, so they do not float in wide cells (FIL-I44-15). */
export const listCardGridClass =
  "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(124px,1fr))] sm:gap-x-8 sm:gap-y-10";

type ListCardProps = {
  href: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  itemCount: number;
  /** Series among the items; omitted when unknown, which reads «títulos» (UX-05). */
  seriesCount?: number;
  posters: PosterStackItem[];
  /** `rail`: fixed width for horizontal scroll; `grid`: fills its grid cell. */
  layout?: "rail" | "grid";
  /** Replaces the film count line, e.g. «De Diego · puedes editar» (FIL-I18). */
  subtitle?: string;
  /** Over the poster stack's top corner: members' avatars or the owner's. */
  badge?: ReactNode;
  /** First card on the page: its front poster is the LCP (FIL-I44-20). */
  priority?: boolean;
};

export const ListCard = ({
  href,
  name,
  itemCount,
  seriesCount,
  posters,
  layout = "rail",
  subtitle,
  badge,
  priority = false,
}: ListCardProps) => {
  const countLabel = subtitle ?? collectionCountLabel(itemCount, seriesCount);

  return (
    <Link
      href={href}
      className={cn(
        "block sm:w-full sm:min-w-0",
        layout === "rail" ? "w-[110px] shrink-0 snap-start" : "w-full min-w-0",
        focusRing,
      )}
    >
      <FanOnView className="group relative rounded-2xl card-physics press-scale sm:max-w-[124px]">
        <PosterStack posters={posters} priority={priority} live />
        {badge ? <div className="absolute right-1.5 top-1.5 z-40">{badge}</div> : null}
        <div className="absolute inset-x-0 bottom-0 z-40 rounded-b-2xl bg-gradient-to-t from-canvas via-canvas/90 to-transparent px-2.5 pb-2.5 pt-12 sm:hidden">
          <h2 className="line-clamp-3 text-sm font-semibold leading-tight text-paper [overflow-wrap:anywhere] hyphens-auto">{name}</h2>
          <p className="text-xs text-fog">{countLabel}</p>
        </div>
      </FanOnView>
      <h2 className="mt-3 hidden line-clamp-2 text-base font-semibold leading-snug text-paper sm:block">
        {name}
      </h2>
      <p className="mt-0.5 hidden text-sm text-fog sm:block">{countLabel}</p>
    </Link>
  );
};
