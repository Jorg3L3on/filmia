import { CinePoster, PremiereTag } from "@/components/cine/CinePoster";
import { CineRail, CineSection, railItemClass } from "@/components/cine/CineParts";
import type { WatchlistCinemaFilm } from "@/lib/cine";
import { formatShortDay, premiereTag } from "@/lib/cine-core";

/** Quiero ver on Cine, in the En cines rail: poster, director, and whether it is showing yet. */
export const WatchlistCinema = ({ films, today }: { films: WatchlistCinemaFilm[]; today: string }) => {
  if (films.length === 0) {
    return null;
  }

  return (
    <CineSection id="quiero-ver-en-cine" title="Quiero ver" aside="En cines, y las que todavía no">
      <CineRail label="Quiero ver">
        {films.map((film, index) => {
          const inTheaters = film.status === "now";
          const tag = inTheaters ? premiereTag(film.mxReleaseDate, today) : null;
          const when = formatShortDay(film.mxReleaseDate);
          return (
            <div key={film.catalogId} role="listitem" className={railItemClass}>
              <CinePoster
                film={film}
                priority={index < 3}
                badge={tag ? <PremiereTag label={tag} /> : null}
                caption={inTheaters ? `En cines · ${when}` : `Aún no · ${when}`}
              />
            </div>
          );
        })}
      </CineRail>
    </CineSection>
  );
};
