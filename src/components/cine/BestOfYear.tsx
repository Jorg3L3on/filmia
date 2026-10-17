import Link from "next/link";
import { CineSection } from "@/components/cine/CineParts";
import { YearTopRow } from "@/components/cine/YearTopRow";
import { YourTopCard } from "@/components/cine/YourTopCard";
import type { CineFilm } from "@/lib/cine";
import { mxToday } from "@/lib/cine-core";
import { topYearOptions, YEAR_TOP_SIZE } from "@/lib/cine-top";
import {
  getUserYearTop,
  getWatchedCatalogIds,
  getWatchedMoviesOfYear,
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
  streaming: [],
});

/** Year chips; `hrefFor` keeps the page (Cine or the full top) and lands on the section. */
export const YearSelector = ({ year, hrefFor }: { year: number; hrefFor: (year: number) => string }) => (
  <nav aria-label="Año" className="rail -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
    {topYearOptions(mxToday()).map((option) => (
      <Link
        key={option}
        href={hrefFor(option)}
        scroll={false}
        aria-current={option === year ? "page" : undefined}
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-sm tabular-nums transition-colors",
          option === year ? "bg-cine font-semibold text-ink" : "bg-white/[0.06] text-fog hover:text-paper",
          focusRing,
        )}
      >
        {option}
      </Link>
    ))}
  </nav>
);

/** What the block and the full page share: the IMDb ten, what you saw of them, your own top. */
export const loadBestOfYear = async (userId: string, year: number) => {
  const top = await getYearTop(year);
  const currentYear = Number(mxToday().slice(0, 4));
  if (top.length === 0 && year < currentYear - 1) {
    requestYearTop(year);
  }
  const [watchedIds, yours, watched] = await Promise.all([
    getWatchedCatalogIds(userId, top.map((film) => film.catalogId)),
    getUserYearTop(userId, year),
    getWatchedMoviesOfYear(userId, year),
  ]);
  return { top, watchedIds, yours, watched, pending: top.length === 0 && year < currentYear - 1 };
};

export const BestOfYearList = ({
  year,
  top,
  watchedIds,
  limit = YEAR_TOP_SIZE,
  pending,
}: Pick<Awaited<ReturnType<typeof loadBestOfYear>>, "top" | "watchedIds" | "pending"> & { year: number; limit?: number }) => {
  if (top.length === 0) {
    return (
      <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-fog">
        {pending ? (
          `Calculando el top de ${year}… vuelve en un momento.`
        ) : (
          <>
            Todavía es pronto para {year}.{" "}
            <Link href={`/cine?anio=${year - 1}#mejor`} scroll={false} className={cn("font-medium text-cine", focusRing)}>
              Mira {year - 1} <span aria-hidden="true">›</span>
            </Link>
          </>
        )}
      </p>
    );
  }
  return (
    <ol className="space-y-1">
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
      <YearSelector year={year} hrefFor={(option) => `/cine?anio=${option}#mejor`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-2">
          {data.top.length > 0 ? (
            <p className="text-sm text-fog">
              Has visto <span className="font-semibold text-paper">{seen}</span> de {data.top.length}
            </p>
          ) : null}
          <BestOfYearList year={year} top={data.top} watchedIds={data.watchedIds} pending={data.pending} limit={5} />
        </div>
        <YourTopCard year={year} top={data.yours} watched={data.watched} />
      </div>
    </CineSection>
  );
};
