"use client";

import Link from "next/link";
import { ImdbBadge } from "@/components/ImdbBadge";
import { PersonalRating } from "@/components/PersonalRating";
import { PlatformBadge } from "@/components/PlatformBadge";
import { PosterImage } from "@/components/PosterImage";
import { TagPills } from "@/components/TagPills";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { titleInclude } from "@/lib/queries";
import type { Prisma } from "@/generated/prisma/client";

type TitleCardProps = {
  title: Prisma.TitleGetPayload<{ include: typeof titleInclude }>;
};

export const TitleCard = ({ title }: TitleCardProps) => {
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
          <div className="flex flex-col gap-1.5">
            <ImdbBadge rating={title.imdbRating} />
            <PersonalRating rating={title.rating} size="sm" />
          </div>
          <PlatformBadge platform={title.platform} compact />
          <TagPills tags={title.tags.map((item) => item.tag)} />
        </div>
      </Link>
    </article>
  );
};
