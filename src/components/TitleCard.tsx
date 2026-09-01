"use client";

import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { TagPills } from "@/components/TagPills";
import {
  formatImdbRating,
  formatRating,
  PLATFORM_LABEL,
  TITLE_KIND_LABEL,
} from "@/lib/labels";
import type { titleInclude } from "@/lib/queries";
import type { Prisma } from "@/generated/prisma/client";

type TitleCardProps = {
  title: Prisma.TitleGetPayload<{ include: typeof titleInclude }>;
};

export const TitleCard = ({ title }: TitleCardProps) => {
  const imdbLabel = formatImdbRating(title.imdbRating);

  return (
    <article className="group overflow-hidden rounded-lg border border-[#2c3440] bg-[#1c2228] shadow-sm transition hover:-translate-y-0.5 hover:border-[#00e054]/50">
      <Link
        href={`/titulos/${title.id}`}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
        aria-label={`${title.name}${title.year ? ` (${title.year})` : ""}`}
      >
        <PosterImage name={title.name} posterPath={title.posterPath} />
        <div className="space-y-2 p-3">
          <p className="text-[11px] uppercase tracking-wider text-[#678]">
            {TITLE_KIND_LABEL[title.kind]}
            {title.year ? ` · ${title.year}` : ""}
          </p>
          <h2 className="font-serif text-lg leading-tight text-white group-hover:text-[#00e054]">
            {title.name}
          </h2>
          <p className="text-sm text-[#ff8000]">{formatRating(title.rating)}</p>
          {imdbLabel ? (
            <p className="text-xs font-medium text-[#f5c518]">{imdbLabel}</p>
          ) : null}
          {title.platform ? (
            <p className="text-xs text-[#99aabb]">{PLATFORM_LABEL[title.platform]}</p>
          ) : null}
          <TagPills tags={title.tags.map((item) => item.tag)} />
        </div>
      </Link>
    </article>
  );
};
