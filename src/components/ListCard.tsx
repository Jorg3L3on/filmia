import Link from "next/link";
import { PosterStack, type PosterStackItem } from "@/components/PosterStack";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/** Wrapping 3-up grid for `layout="grid"` cards (Personalizadas). */
export const listCardGridClass = "grid grid-cols-3 gap-x-3 gap-y-5 sm:gap-10 lg:grid-cols-4";

type ListCardProps = {
  href: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  itemCount: number;
  posters: PosterStackItem[];
  /** `rail`: fixed width for horizontal scroll; `grid`: fills its grid cell. */
  layout?: "rail" | "grid";
};

export const ListCard = ({
  href,
  name,
  itemCount,
  posters,
  layout = "rail",
}: ListCardProps) => {
  const countLabel = `${itemCount} ${itemCount === 1 ? "película" : "películas"}`;

  return (
    <Link
      href={href}
      className={cn(
        "block sm:w-full sm:min-w-0",
        layout === "rail" ? "w-[110px] shrink-0 snap-start" : "w-full min-w-0",
        focusRing,
      )}
    >
      <div className="group relative rounded-2xl card-physics press-scale sm:max-w-[124px]">
        <PosterStack posters={posters} />
        <div className="absolute inset-x-0 bottom-0 z-40 rounded-b-2xl bg-gradient-to-t from-canvas via-canvas/90 to-transparent px-2.5 pb-2.5 pt-12 sm:hidden">
          <h2 className="truncate text-sm font-semibold text-paper">{name}</h2>
          <p className="text-xs text-fog">{countLabel}</p>
        </div>
      </div>
      <h2 className="mt-3 hidden truncate text-base font-semibold text-paper sm:block">
        {name}
      </h2>
      <p className="mt-0.5 hidden text-sm text-fog sm:block">{countLabel}</p>
    </Link>
  );
};
