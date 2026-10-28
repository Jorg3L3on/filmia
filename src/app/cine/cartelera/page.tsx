import type { CSSProperties } from "react";
import { Suspense } from "react";
import { CarteleraOrderToggle } from "@/components/cine/CarteleraOrderToggle";
import { CineActionsProvider } from "@/components/cine/CineActions";
import { CineMarquee, CineRail, CineSection, railItemClass } from "@/components/cine/CineParts";
import { CinePoster, PremiereTag } from "@/components/cine/CinePoster";
import { CarteleraSkeleton } from "@/components/cine/CineSkeleton";
import { loadCineActions } from "@/app/cine/cine-data";
import { getNowShowing } from "@/lib/cine";
import { formatShortDay, mxToday, parseCarteleraOrder, premiereTag, splitCartelera, ticketStub, watchlistFirst } from "@/lib/cine-core";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "En cines",
} as const;

type SearchParams = { orden?: string | string[] };

/**
 * Cartelera B (FIL-I23-5): «Esta semana» as a rail of this premiere week's films, then «Siguen en
 * cartelera» as the grid of the rest, newest or most popular first.
 */
export default function CarteleraPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <Suspense fallback={<CarteleraSkeleton />}>
        <Cartelera searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const Cartelera = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const today = mxToday();
  const order = parseCarteleraOrder((await searchParams).orden);
  const [actions, films] = await Promise.all([loadCineActions(), getNowShowing()]);
  const split = splitCartelera(films, today, order);
  const { weekStart } = split;
  const thisWeek = watchlistFirst(split.thisWeek, actions.existing);
  const rest = watchlistFirst(split.rest, actions.existing);
  const stub = ticketStub(weekStart);

  return (
    <CineActionsProvider
      existing={actions.existing}
      lists={actions.lists}
      memberships={actions.memberships}
      pinnedTitleId={actions.pinnedTitleId}
    >
      <CineMarquee
        title="En cines"
        subtitle={films.length > 0 ? `${plural(films.length, "película", "películas")} en México` : "Películas en México"}
        backHref="/cine"
      />
      {films.length === 0 ? (
        <p className="text-sm text-fog">La cartelera se actualiza cada mañana.</p>
      ) : (
        <div className="space-y-10">
          {thisWeek.length > 0 ? (
            <CineSection
              id="esta-semana"
              title="Esta semana"
              aside={`${plural(thisWeek.length, "estreno", "estrenos")} · desde el ${stub.weekday.toLowerCase()} ${formatShortDay(weekStart)}`}
            >
              <CineRail label="Esta semana">
                {thisWeek.map((film, index) => {
                  const tag = premiereTag(film.mxReleaseDate, today);
                  return (
                    <div key={film.catalogId} role="listitem" className={railItemClass}>
                      <CinePoster
                        film={film}
                        priority={index < 3}
                        badge={tag ? <PremiereTag label={tag} /> : null}
                        caption={`Desde ${formatShortDay(film.mxReleaseDate)}`}
                      />
                    </div>
                  );
                })}
              </CineRail>
            </CineSection>
          ) : null}

          {rest.length > 0 ? (
            <CineSection id="siguen" title="Siguen en cartelera" aside={plural(rest.length, "película", "películas")}>
              <CarteleraOrderToggle order={order} />
              <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5 sm:gap-x-4">
                {rest.map((film, index) => (
                  <li key={film.catalogId} className="min-w-0 stagger-in" style={{ "--stagger": Math.min(index, 14) } as CSSProperties}>
                    <CinePoster
                      film={film}
                      priority={index < 6}
                      sizes="(max-width: 640px) 31vw, 180px"
                      caption={`Desde ${formatShortDay(film.mxReleaseDate)}`}
                    />
                  </li>
                ))}
              </ul>
            </CineSection>
          ) : null}
        </div>
      )}
    </CineActionsProvider>
  );
};
