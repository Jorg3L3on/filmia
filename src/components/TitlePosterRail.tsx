import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { PosterRail } from "@/components/PosterRail";
import { cn } from "@/lib/cn";
import { eyebrowClass, focusRing, posterFrame } from "@/lib/ui";

type RailTitle = {
  id: string;
  name: string;
  year: number | null;
  posterPath: string | null;
};

type TitlePosterRailProps = {
  title: string;
  titles: RailTitle[];
  ariaLabel: string;
};

export const TitlePosterRail = ({
  title,
  titles,
  ariaLabel,
}: TitlePosterRailProps) => {
  if (titles.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className={eyebrowClass}>{title}</h2>
      <PosterRail ariaLabel={ariaLabel}>
        {titles.map((item) => (
          <Link
            key={item.id}
            href={`/titulos/${item.id}`}
            role="listitem"
            aria-label={`${item.name}${item.year ? ` (${item.year})` : ""}`}
            className={cn("w-[108px] shrink-0 snap-start sm:w-[128px]", focusRing)}
          >
            <PosterImage
              name={item.name}
              posterPath={item.posterPath}
              sizes="128px"
              className={posterFrame}
            />
            <p className="mt-1.5 truncate text-xs text-white">{item.name}</p>
          </Link>
        ))}
      </PosterRail>
    </section>
  );
};
