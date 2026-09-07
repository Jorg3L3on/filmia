"use client";

import Link from "next/link";
import { ImdbBadge } from "@/components/ImdbBadge";
import { PersonalRating } from "@/components/PersonalRating";
import { PosterImage } from "@/components/PosterImage";
import { TagPills } from "@/components/TagPills";
import { WatchedBadge } from "@/components/WatchedBadge";
import { SeriesStatusBadge } from "@/components/SeriesStatusBadge";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { TitleWithTags } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { focusRing, posterFrame } from "@/lib/ui";

type TitleCardProps = {
  title: TitleWithTags;
};

export const TitleCard = ({ title }: TitleCardProps) => {
  return (
    <article className="group min-w-0">
      <Link
        href={`/titulos/${title.id}`}
        className={cn("block", focusRing)}
        aria-label={`${title.name}${title.year ? ` (${title.year})` : ""}`}
      >
        <div className="relative">
          <PosterImage
            name={title.name}
            posterPath={title.posterPath}
            className={cn(posterFrame, "transition duration-200 group-hover:brightness-110")}
          />
          {title.watchedAt ? (
            <WatchedBadge compact className="absolute left-2 top-2" />
          ) : null}
          {title.kind === "SERIES" && title.seriesStatus ? (
            <SeriesStatusBadge
              status={title.seriesStatus}
              compact
              className="absolute right-2 top-2"
            />
          ) : null}
        </div>
        <div className="space-y-1.5 pt-2">
          <p className="text-[11px] uppercase tracking-wider text-mist">
            {TITLE_KIND_LABEL[title.kind]}
            {title.year ? ` · ${title.year}` : ""}
          </p>
          <h2 className="font-serif text-base leading-tight text-white group-hover:text-accent">
            {title.name}
          </h2>
          <div className="flex flex-col gap-1">
            <ImdbBadge rating={title.imdbRating} />
            <PersonalRating rating={title.rating} size="sm" />
          </div>
        </div>
      </Link>
      <div className="pt-1.5">
        <TagPills tags={title.tags.map((item) => item.tag)} compact />
      </div>
    </article>
  );
};
