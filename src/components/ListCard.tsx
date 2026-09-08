import Link from "next/link";
import { PosterStack, type PosterStackItem } from "@/components/PosterStack";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type ListCardProps = {
  href: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  itemCount: number;
  posters: PosterStackItem[];
};

export const ListCard = ({ href, name, itemCount, posters }: ListCardProps) => {
  const countLabel = itemCount === 1 ? "1 película" : `${itemCount} películas`;

  return (
    <Link
      href={href}
      className={cn(
        "block w-[110px] shrink-0 snap-start sm:w-full sm:min-w-0",
        focusRing,
      )}
    >
      <div className="relative card-physics press-scale sm:max-w-[124px]">
        <PosterStack posters={posters} />
        <div className="absolute inset-x-0 bottom-0 z-40 rounded-b-2xl bg-gradient-to-t from-canvas via-canvas/90 to-transparent px-2.5 pb-2.5 pt-12 sm:hidden">
          <h2 className="truncate text-sm font-semibold text-paper">{name}</h2>
          <p className="text-xs text-fog">{countLabel}</p>
        </div>
      </div>
      <h2 className="mt-3 hidden text-base font-semibold text-paper sm:line-clamp-2 sm:block">
        {name}
      </h2>
      <p className="mt-0.5 hidden text-sm text-fog sm:block">{countLabel}</p>
    </Link>
  );
};
