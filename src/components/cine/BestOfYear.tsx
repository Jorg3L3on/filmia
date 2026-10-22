import Link from "next/link";
import { CineSection, GhostPoster } from "@/components/cine/CineParts";
import { YearSelector } from "@/components/cine/YearSelector";
import { YearTopRow } from "@/components/cine/YearTopRow";
import { YourTopCard } from "@/components/cine/YourTopCard";
import type { CineFilm } from "@/lib/cine";
import { mxToday } from "@/lib/cine-core";
import { pendingTopDayLabel, YEAR_TOP_SIZE } from "@/lib/cine-top";
import {
  getUserYearTop,
  getWatchedCatalogIds,
  getWatchedMoviesOfYear,
  getYearsWithTop,
  getYearTop,
  requestYearTop,
  type YearTopFilm,
} from "@/lib/cine-top-store";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export const yearTopFilm = (film: YearTopFilm): CineFilm => ({
  catalogId: film.catalogId,
  tmdbId: film.tmdbId,
  name: film.name,
  originalName: film.originalName,
  year: film.year,
  posterPath: film.posterPath,
  mxReleaseDate: "",
  status: "gone",
  popularity: 0,
  streaming: [],
});

/** What the block and the full page share: the IMDb ten, what you saw of them, your own top. */
export const loadBestOfYear = async (userId: string, year: number) => {
  const today = mxToday();
  const top = await getYearTop(year);
  const currentYear = Number(today.slice(0, 4));
  const pending = top.length === 0 && year < currentYear - 1;
  if (pending) {
    requestYearTop(year);
  }
  const [watchedIds, yours, watched, yearsWithTop] = await Promise.all([
    getWatchedCatalogIds(userId, top.map((film) => film.catalogId)),
    getUserYearTop(userId, year),
    getWatchedMoviesOfYear(userId, year),
    pending ? getYearsWithTop() : Promise.resolve<number[]>([]),
  ]);
  return {
    today,
    top,
    watchedIds,
    yours,
    watched,
    pending,
    pendingDay: pending ? pendingTopDayLabel(year, yearsWithTop, today) : null,
    past: year < currentYear,
  };
};

type BestOfYearData = Awaited<ReturnType<typeof loadBestOfYear>>;

/** «Has visto 3 de 10», or the two ends in words. */
export const seenOfTopLabel = (seen: number, total: number) =>
  seen === 0 ? "Ninguna vista todavía" : seen >= total ? "Las viste todas" : null;

const SeenOfTop = ({ seen, total }: { seen: number; total: number }) => {
  const words = seenOfTopLabel(seen, total);
  return (
    <p className="text-sm text-fog">
      {words ?? (
        <>
          Has visto <span className="font-semibold text-paper">{seen}</span> de {total}
        </>
      )}
    </p>
  );
};

/** Three rows the ranking will fill: the pending block keeps its height. */
const GhostRows = () => (
  <ol aria-hidden="true" className="space-y-1">
    {[1, 2, 3].map((rank) => (
      <li key={rank} className="flex items-center gap-3 py-1.5 pr-2">
        <span className="w-9 shrink-0 text-right font-serif text-[2.1rem] leading-none tabular-nums text-paper/15">{rank}</span>
        <GhostPoster className="w-11 shrink-0" />
        <span className="flex-1 space-y-2">
          <span className="block h-3 w-3/5 rounded-full bg-white/[0.06]" />
          <span className="block h-2.5 w-2/5 rounded-full bg-white/[0.04]" />
        </span>
      </li>
    ))}
  </ol>
);

export const BestOfYearList = ({
  year,
  top,
  watchedIds,
  limit = YEAR_TOP_SIZE,
  pending,
  pendingDay,
}: Pick<BestOfYearData, "top" | "watchedIds" | "pending" | "pendingDay"> & { year: number; limit?: number }) => {
  if (top.length === 0) {
    const previous = (
      <Link href={`/cine?anio=${year - 1}#mejor`} scroll={false} className={cn("font-medium text-cine", focusRing)}>
        mira {year - 1} <span aria-hidden="true">›</span>
      </Link>
    );
    return (
      <div className="space-y-3">
        <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-fog">
          {pending ? (
            <>
              Todavía no tenemos el top de {year}. Lo calculamos {pendingDay}; mientras, {previous}
            </>
          ) : (
            <>Todavía es pronto para {year}. Mientras, {previous}</>
          )}
        </p>
        {pending ? <GhostRows /> : null}
      </div>
    );
  }
  return (
    <ol id={`top-${year}`} className="space-y-1">
      {top.slice(0, limit).map((film) => (
        <li key={film.catalogId}>
          <YearTopRow
            rank={film.rank}
            film={yearTopFilm(film)}
            imdbRating={film.imdbRating}
            imdbVotes={film.imdbVotes}
            watched={watchedIds.has(film.catalogId)}
          />
        </li>
      ))}
    </ol>
  );
};

/** Cine's last block: «Lo mejor del año · según IMDb» and «Tu top 10 de {año}» beside it. */
export const BestOfYearSection = async ({ userId, year }: { userId: string; year: number }) => {
  const data = await loadBestOfYear(userId, year);
  const seen = data.top.filter((film) => data.watchedIds.has(film.catalogId)).length;

  return (
    <CineSection
      id="mejor"
      title="Lo mejor del año"
      aside="según IMDb"
      moreHref={data.top.length > 0 ? `/cine/mejor/${year}` : undefined}
      moreLabel={`Ver las ${data.top.length}`}
    >
      <YearSelector year={year} today={data.today} hrefTemplate="/cine?anio={year}#mejor" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-2">
          {data.top.length > 0 ? <SeenOfTop seen={seen} total={data.top.length} /> : null}
          <BestOfYearList year={year} top={data.top} watchedIds={data.watchedIds} pending={data.pending} pendingDay={data.pendingDay} limit={5} />
        </div>
        <YourTopCard year={year} top={data.yours} watched={data.watched} past={data.past} topHref={data.top.length > 0 ? "#mejor" : null} />
      </div>
    </CineSection>
  );
};

export { SeenOfTop };
