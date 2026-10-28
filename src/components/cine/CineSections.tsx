import Link from "next/link";
import { CinePoster, PremiereTag } from "@/components/cine/CinePoster";
import { CineRail, GhostPoster, railItemClass, TicketStub, weekCountLabel } from "@/components/cine/CineParts";
import { FadeRail } from "@/components/cine/FadeRail";
import { PlatformLogo } from "@/components/PlatformLogo";
import type { CineFilm, HomeArrival } from "@/lib/cine";
import { formatShortDay, groupByWeek, premiereTag } from "@/lib/cine-core";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { focusRing } from "@/lib/ui";

/** En cines: the newest premieres first, «Hoy» on the premiere day and «Estreno» three days after. */
export const NowShowingRail = ({ films, today }: { films: CineFilm[]; today: string }) => (
  <CineRail label="En cines">
    {films.map((film, index) => {
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
);

/** The day most of a week's films open on (Thursday, usually): the stub shows it. */
const leadDay = (films: readonly CineFilm[]) => {
  const counts = new Map<string, number>();
  for (const film of films) {
    counts.set(film.mxReleaseDate, (counts.get(film.mxReleaseDate) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? films[0]?.mxReleaseDate ?? "";
};

export const weekAnchor = (week: string) => `semana-${week}`;

/**
 * Próximamente: one row per week, a ticket stub with its day and the month as a heading. On
 * /cine (`linkWeeks`) the stub links to its week on /cine/proximamente and carries the count (P6).
 */
export const UpcomingTimeline = ({
  films,
  showMonths = true,
  linkWeeks = false,
}: {
  films: CineFilm[];
  showMonths?: boolean;
  linkWeeks?: boolean;
}) => {
  if (films.length === 0) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <GhostPoster className="w-14 shrink-0" />
        <p className="text-sm text-fog">Aún no hay estrenos anunciados hasta diciembre.</p>
      </div>
    );
  }

  const weeks = groupByWeek(films);
  return (
    <ol className="space-y-5">
      {weeks.map((week, index) => {
        const lead = leadDay(week.items);
        const newMonth = showMonths && (index === 0 || weeks[index - 1]?.month !== week.month);
        return (
          <li key={week.week} id={linkWeeks ? undefined : weekAnchor(week.week)} className="scroll-mt-24 space-y-3">
            {newMonth ? (
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cine">{week.month}</h3>
            ) : null}
            <div className="flex gap-3">
              <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
                {linkWeeks ? (
                  <Link
                    href={`/cine/proximamente#${weekAnchor(week.week)}`}
                    aria-label={`Semana del ${formatShortDay(week.week)}: ${weekCountLabel(week.items.length)}, ver en Próximamente`}
                    className={cn("flex flex-col items-center gap-1 rounded-lg", focusRing)}
                  >
                    <TicketStub day={lead} />
                    <span className="text-[10px] tabular-nums text-mist">{weekCountLabel(week.items.length)}</span>
                  </Link>
                ) : (
                  <>
                    <TicketStub day={lead} />
                    <span className="text-[10px] tabular-nums text-mist">{weekCountLabel(week.items.length)}</span>
                  </>
                )}
                <span aria-hidden="true" className="w-px flex-1 bg-gradient-to-b from-white/15 to-transparent" />
              </div>
              <FadeRail
                label={`Semana del ${formatShortDay(week.week)}`}
                className="-mr-4 flex min-w-0 flex-1 snap-x gap-3 overflow-x-auto overscroll-x-contain pb-1 pr-4 touch-pan-x"
              >
                {week.items.map((film, itemIndex) => (
                  <div key={film.catalogId} role="listitem" className="w-[26vw] max-w-[8.5rem] shrink-0 snap-start sm:w-[8.5rem]">
                    <CinePoster
                      film={film}
                      priority={index === 0 && itemIndex < 3}
                      sizes="(max-width: 640px) 28vw, 140px"
                      compact
                      caption={film.mxReleaseDate === lead ? undefined : formatShortDay(film.mxReleaseDate)}
                    />
                  </div>
                ))}
              </FadeRail>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

/** Ya en casa: out of theaters, now streaming in MX — yours first, the rest dimmed. */
export const HomeArrivalsRail = ({ films, hasPlatforms }: { films: HomeArrival[]; hasPlatforms: boolean }) => {
  if (films.length === 0) {
    return (
      <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-fog">
        Ninguna película reciente de cartelera llegó todavía a streaming en México.
      </p>
    );
  }
  const dimmed = hasPlatforms && films.some((film) => !film.onMine);
  return (
    <div className="space-y-2">
      <CineRail label="Ya en casa">
        {films.map((film, index) => {
          const platform = film.streaming[0];
          return (
            <div key={film.catalogId} role="listitem" className={railItemClass}>
              <CinePoster
                film={film}
                priority={index < 3}
                dim={hasPlatforms && !film.onMine}
                badge={platform ? <PlatformLogo platform={platform} size={22} className="rounded-md shadow-md" /> : null}
                caption={streamingCaption(film.streaming)}
              />
            </div>
          );
        })}
      </CineRail>
      {dimmed ? <p className="text-[11px] text-mist">Las tenues están en plataformas que no tienes.</p> : null}
    </div>
  );
};

/** «Netflix», or «Netflix +1» from two platforms (the full list is on the ficha). */
export const streamingCaption = (streaming: readonly CineFilm["streaming"][number][]) => {
  const first = streaming[0];
  if (!first) {
    return undefined;
  }
  return streaming.length > 1 ? `${PLATFORM_SERVICE_LABEL[first]} +${streaming.length - 1}` : PLATFORM_SERVICE_LABEL[first];
};
