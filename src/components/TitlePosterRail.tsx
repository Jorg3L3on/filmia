import Link from "next/link";
import type { CSSProperties } from "react";
import { PosterImage } from "@/components/PosterImage";
import { PosterRail } from "@/components/PosterRail";
import { SharedPoster } from "@/components/SharedPoster";
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
        {titles.map((item, index) => (
          <Link
            key={item.id}
            href={`/titulos/${item.id}`}
            role="listitem"
            aria-label={`${item.name}${item.year ? ` (${item.year})` : ""}`}
            className={cn(
              "card-physics press-scale stagger-in w-[108px] shrink-0 snap-start sm:w-[128px]",
              focusRing,
            )}
            style={{ "--stagger": index } as CSSProperties}
          >
            <SharedPoster titleId={item.id}>
              <PosterImage
                name={item.name}
                posterPath={item.posterPath}
                sizes="128px"
                className={posterFrame}
              />
            </SharedPoster>
            <p className="mt-1.5 truncate font-serif text-xs text-paper">{item.name}</p>
          </Link>
        ))}
      </PosterRail>
    </section>
  );
};
