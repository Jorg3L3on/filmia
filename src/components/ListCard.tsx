import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type ListCardPoster = {
  id: string;
  name: string;
  posterPath: string | null;
};

type ListCardProps = {
  href: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  itemCount: number;
  posters: ListCardPoster[];
};

export const ListCard = ({ href, name, itemCount, posters }: ListCardProps) => {
  const countLabel = itemCount === 1 ? "1 película" : `${itemCount} películas`;

  return (
    <Link
      href={href}
      className={`block w-[168px] shrink-0 snap-start sm:w-[188px] ${focusRing}`}
    >
      <PosterStack posters={posters} />
      <h2 className="mt-3 truncate text-base font-semibold text-paper">{name}</h2>
      <p className="mt-0.5 text-sm text-fog">{countLabel}</p>
    </Link>
  );
};

const PosterStack = ({ posters }: { posters: ListCardPoster[] }) => {
  const shown = posters.slice(0, 3);

  if (shown.length === 0) {
    return (
      <div className="flex aspect-[2/3] items-center justify-center rounded-2xl border border-dashed border-chrome bg-well text-xs text-mist">
        Vacía
      </div>
    );
  }

  return (
    <div className="relative h-[210px] w-full sm:h-[236px]" aria-hidden="true">
      {shown.map((title, index) => (
        <div
          key={title.id}
          className={cn(
            "absolute top-0 overflow-hidden rounded-2xl border border-canvas bg-well shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
            index === 0 ? "left-0 z-30 h-full w-[72%]" : "h-[88%] w-[58%]",
          )}
          style={
            index === 0
              ? undefined
              : {
                  left: `${28 + index * 18}%`,
                  top: `${6 * index}%`,
                  zIndex: 30 - index,
                }
          }
        >
          <PosterImage
            name={title.name}
            posterPath={title.posterPath}
            sizes="140px"
            className="h-full rounded-none"
            ratio="fill"
          />
        </div>
      ))}
    </div>
  );
};
