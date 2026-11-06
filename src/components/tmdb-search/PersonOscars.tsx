"use client";

import Link from "next/link";
import { useState } from "react";
import { PosterImage } from "@/components/PosterImage";
import { LaurelIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import {
  oscarNominationsLine,
  oscarRowMeta,
  oscarsHeader,
  visibleOscarRows,
  type PersonOscarRow,
  type PersonOscars as PersonOscarsData,
} from "@/lib/person-oscars";
import { previewFichaHref } from "@/lib/title-preview";
import { focusRing, glassPanelClass } from "@/lib/ui";

const OscarRowBody = ({ row }: { row: PersonOscarRow }) => (
  <>
    {row.title ? (
      <span className="block w-9 shrink-0 overflow-hidden rounded-md">
        <PosterImage name={row.title} posterPath={row.posterPath} sizes="36px" tmdbSize="w185" />
      </span>
    ) : (
      <span className="flex h-[54px] w-9 shrink-0 items-center justify-center rounded-md bg-star/10 text-star" aria-hidden="true">
        <LaurelIcon size={18} />
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className="line-clamp-2 text-sm leading-snug text-paper">{row.title ?? row.categoryEs}</span>
      <span className="mt-0.5 line-clamp-1 text-xs text-paper/70">{oscarRowMeta(row)}</span>
    </span>
  </>
);

/** «2 Óscar · 16 nominaciones» and one row per win, under the person's stats (FIL-I43). */
export const PersonOscars = ({ oscars }: { oscars: PersonOscarsData }) => {
  const [expanded, setExpanded] = useState(false);

  if (oscars.wins.length === 0) {
    return (
      <section
        aria-label="Óscar"
        className={cn(glassPanelClass, "flex items-center gap-2 rounded-[20px] px-4 py-3 text-sm text-paper/80")}
      >
        <span className="text-paper/60" aria-hidden="true">
          <LaurelIcon size={14} />
        </span>
        {oscarNominationsLine(oscars.nominations)}
      </section>
    );
  }

  const header = oscarsHeader(oscars);
  const { rows, more } = visibleOscarRows(oscars.wins, expanded);
  return (
    <section aria-label="Óscar" className={cn(glassPanelClass, "space-y-3 rounded-[20px] px-4 py-3.5")}>
      <p className="flex items-baseline gap-2">
        <span className="self-center text-star" aria-hidden="true">
          <LaurelIcon size={16} />
        </span>
        <span className="font-serif text-lg text-paper">{header.wins}</span>
        {header.nominations ? <span className="text-sm text-paper/60">· {header.nominations}</span> : null}
      </p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key}>
            {row.tmdbId ? (
              <Link
                href={previewFichaHref("MOVIE", row.tmdbId)}
                className={cn("press-scale -mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5", focusRing)}
              >
                <OscarRowBody row={row} />
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-1.5">
                <OscarRowBody row={row} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {more ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn("press-scale -mx-1 rounded-full px-1 text-sm text-accent-hover", focusRing)}
        >
          {more}
        </button>
      ) : null}
    </section>
  );
};
