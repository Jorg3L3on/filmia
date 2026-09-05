import Link from "next/link";
import { PosterStack, type PosterStackItem } from "@/components/PosterStack";
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
      className={`block w-[168px] shrink-0 snap-start sm:w-[188px] ${focusRing}`}
    >
      <div className="relative">
        <PosterStack posters={posters} />
        <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-canvas via-canvas/80 to-transparent px-2.5 pb-2.5 pt-12 sm:hidden">
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
