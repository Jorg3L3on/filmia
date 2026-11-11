"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Platform, TitleKind } from "@/db";
import { MarqueeBulbs } from "@/components/cine/CineParts";
import { FadeRail } from "@/components/cine/FadeRail";
import { HitArea } from "@/components/HitArea";
import { PlatformLogo } from "@/components/PlatformLogo";
import { PosterImage } from "@/components/PosterImage";
import { menuVia } from "@/components/tmdb-search/SearchRowMenu";
import { useActTwoActions, type ActTwoTitle } from "@/components/tonight/act-two/ActTwoActions";
import { AfinaTuGusto } from "@/components/tonight/act-two/AfinaTuGusto";
import type { AfinaCard } from "@/lib/cold-start-store";
import type { GemTitle, SeedRail } from "@/lib/service-charts-store";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { nextOfficialDay } from "@/lib/netflix-top10";
import {
  ACT_TWO_SEEN_EVENT,
  ACT_TWO_SEEN_KEY,
  actTwoOrder,
  CHART_KIND_LABEL,
  CHART_KINDS,
  chartHeading,
  chartPlatformsFor,
  chartSourceLine,
  defaultChartKind,
  groupArrivalsByDay,
  rankMovement,
  SERVICE_TINT,
  type ActTwoSection,
  showsMovement,
  weeksOnListLabel,
  type ArrivalTitle,
  type ServiceChart,
} from "@/lib/service-charts";
import { focusRing } from "@/lib/ui";

const statusLabel = (status: ReturnType<ReturnType<typeof useActTwoActions>["statusOf"]>) =>
  status === "watched" ? ", vista" : status === "watchlist" ? ", en Quiero ver" : "";

/** A tile's tap: Buscar's anchored menu on the poster (Quiero ver, Vi esto, Ver ficha…). */
const TitleButton = ({
  title,
  label,
  className,
  children,
}: {
  title: ActTwoTitle;
  label: string;
  className?: string;
  children: (frame: React.RefObject<HTMLDivElement | null>) => ReactNode;
}) => {
  const { openMenu, statusOf } = useActTwoActions();
  const frameRef = useRef<HTMLDivElement>(null);
  const pointerType = useRef<string>("mouse");
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-label={`${label}${statusLabel(statusOf(title))}`}
      className={cn("press-scale select-none text-left [-webkit-touch-callout:none]", focusRing, className)}
      onPointerDown={(event) => {
        pointerType.current = event.pointerType;
      }}
      onClick={() => {
        const node = frameRef.current;
        if (node) {
          openMenu(title, node.getBoundingClientRect(), menuVia(pointerType.current));
        }
      }}
    >
      {children(frameRef)}
    </button>
  );
};

const StatusDot = ({ title }: { title: ActTwoTitle }) => {
  const status = useActTwoActions().statusOf(title);
  if (!status) return null;
  return (
    <span className={cn("act-two-status", status === "watched" ? "is-watched" : "is-queued")} aria-hidden="true">
      {status === "watched" ? "✓" : "+"}
    </span>
  );
};

const MovementChip = ({ rank, previousRank }: { rank: number; previousRank: number | null }) => {
  const movement = rankMovement(rank, previousRank);
  if (movement.kind === "new") {
    return <span className="act-two-move is-new">NUEVO</span>;
  }
  if (movement.kind === "same") {
    return (
      <span className="act-two-move is-same" aria-label="mismo puesto">
        ＝
      </span>
    );
  }
  const up = movement.kind === "up";
  return (
    <span className={cn("act-two-move", up ? "is-up" : "is-down")} aria-label={`${up ? "sube" : "baja"} ${movement.by}`}>
      {up ? "▲" : "▼"} {movement.by}
    </span>
  );
};

/** «Lo más popular en <servicio>»: the user's platforms, films / series, ten outlined numerals. */
const ServiceRanking = ({ charts, userPlatforms }: { charts: ServiceChart[]; userPlatforms: Platform[] }) => {
  const platforms = chartPlatformsFor(userPlatforms, charts);
  const [platform, setPlatform] = useState<Platform | null>(platforms[0] ?? null);
  const [kind, setKind] = useState<TitleKind>(() => (platforms[0] ? defaultChartKind(platforms[0], charts) : "MOVIE"));
  if (!platform) {
    return null;
  }
  const chart = charts.find((entry) => entry.platform === platform && entry.kind === kind);
  const kinds = CHART_KINDS.filter((value) =>
    charts.some((entry) => entry.platform === platform && entry.kind === value && entry.titles.length > 0),
  );
  const source = chart?.source ?? "popularity";
  const withMovement = showsMovement(chart?.titles ?? []);

  const choosePlatform = (next: Platform) => {
    setPlatform(next);
    if (!charts.some((entry) => entry.platform === next && entry.kind === kind && entry.titles.length > 0)) {
      setKind(defaultChartKind(next, charts));
    }
  };

  return (
    <section
      className="act-two-block act-two-ranking"
      aria-labelledby="act-two-ranking-title"
      data-act-two="ranking"
      style={{ "--svc": SERVICE_TINT[platform] } as CSSProperties}
    >
      <div className="act-two-head">
        <h2 id="act-two-ranking-title" className="font-serif">
          {chartHeading(platform, source)}
        </h2>
        <p>{chartSourceLine(platform, source, chart?.period)}</p>
      </div>
      {platforms.length > 1 ? (
        <div className="act-two-services" role="group" aria-label="Plataforma">
          {platforms.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === platform}
              onClick={() => choosePlatform(value)}
              className={cn("act-two-service press-scale", focusRing)}
              style={{ "--svc": SERVICE_TINT[value] } as CSSProperties}
            >
              <PlatformLogo platform={value} size={22} className="rounded-[7px]" />
              {PLATFORM_SERVICE_LABEL[value]}
            </button>
          ))}
        </div>
      ) : null}
      {kinds.length > 1 ? (
        <div className="act-two-kinds" role="group" aria-label="Tipo">
          {kinds.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === kind}
              onClick={() => setKind(value)}
              className={cn("act-two-kind", focusRing)}
            >
              {CHART_KIND_LABEL[value]}
            </button>
          ))}
        </div>
      ) : null}
      <FadeRail
        key={`${platform}-${kind}`}
        label={`${chartHeading(platform, source)} · ${CHART_KIND_LABEL[kind]}`}
        className="act-two-rail act-two-rise"
      >
        {(chart?.titles ?? []).map((title, index) => (
          <div key={title.catalogId} role="listitem" style={{ "--i": index } as CSSProperties}>
            <TitleButton
              title={title}
              label={`N.º ${title.rank}: ${title.name}${title.year ? ` (${title.year})` : ""}`}
              className="act-two-rank"
            >
              {(frameRef) => (
                <>
                  <span className={cn("act-two-numeral font-serif", title.rank >= 10 && "is-wide")} aria-hidden="true">
                    {title.rank}
                  </span>
                  <div ref={frameRef} className="act-two-rank-poster">
                    <PosterImage name={title.name} posterPath={title.posterPath} ratio="fill" sizes="112px" />
                    <StatusDot title={title} />
                  </div>
                  {withMovement || title.weeksOnList != null ? (
                    <span className="act-two-rank-meta">
                      {withMovement ? <MovementChip rank={title.rank} previousRank={title.previousRank} /> : null}
                      {source === "official" ? <span>{weeksOnListLabel(title.weeksOnList)}</span> : null}
                    </span>
                  ) : null}
                </>
              )}
            </TitleButton>
          </div>
        ))}
      </FadeRail>
    </section>
  );
};

/** «Recién llegó»: a dated list by day under the marquee bulbs; hidden when the week is empty. */
const RecentArrivals = ({ arrivals, now }: { arrivals: ArrivalTitle[]; now: Date }) => {
  if (arrivals.length === 0) {
    return null;
  }
  const days = groupArrivalsByDay(arrivals, now);
  return (
    <section className="act-two-block" aria-labelledby="act-two-arrivals-title" data-act-two="arrivals">
      <MarqueeBulbs count={8} className="px-1" />
      <div className="act-two-head">
        <h2 id="act-two-arrivals-title" className="font-serif">
          Recién <em>llegó</em>
        </h2>
        <p>
          Esta semana en tus plataformas · {arrivals.length} {arrivals.length === 1 ? "título" : "títulos"}
        </p>
      </div>
      <ol className="act-two-days">
        {days.map((day) => (
          <li key={day.day} className="act-two-day">
            <p className="act-two-date" aria-label={day.label === "HOY" || day.label === "AYER" ? day.label.toLowerCase() : undefined}>
              <span className="font-serif">{day.dayOfMonth}</span>
              {day.label}
            </p>
            <ul className="act-two-day-titles">
              {day.titles.map((title) => (
                <li key={title.catalogId}>
                  <TitleButton
                    title={title}
                    label={`${title.name}${title.year ? ` (${title.year})` : ""}, llegó a ${PLATFORM_SERVICE_LABEL[title.platform]}`}
                    className="act-two-row"
                  >
                    {(frameRef) => (
                      <>
                        <div ref={frameRef} className="act-two-row-poster">
                          <PosterImage name={title.name} posterPath={title.posterPath} ratio="fill" sizes="46px" />
                        </div>
                        <span className="act-two-row-text">
                          <span className="act-two-row-title">{title.name}</span>
                          <span className="act-two-row-meta">
                            {[title.kind === "SERIES" ? "Serie" : "Película", title.year]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <PlatformLogo platform={title.platform} size={24} className="rounded-[7px]" />
                      </>
                    )}
                  </TitleButton>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
};

export type ActTwoGem = GemTitle & { platform: Platform; backdropUrl: string };

/** «Joyas que ya pagas»: wide stills, the critics' scores as stored (FIL-I47-4). */
const Gems = ({ gems }: { gems: ActTwoGem[] }) => {
  if (gems.length === 0) {
    return null;
  }
  return (
    <section className="act-two-block" aria-labelledby="act-two-gems-title" data-act-two="gems">
      <div className="act-two-head">
        <h2 id="act-two-gems-title" className="font-serif">
          Joyas que <em>ya pagas</em>
        </h2>
        <p>Muy bien calificadas por la crítica, fuera de lo más visto</p>
      </div>
      <FadeRail label="Joyas que ya pagas" className="act-two-rail">
        {gems.map((gem) => {
          const scores = [
            gem.imdbRating != null ? `IMDb ${gem.imdbRating.toFixed(1)}` : null,
            gem.rtScore != null ? `RT ${gem.rtScore} %` : null,
            gem.metascore != null ? `Metacritic ${gem.metascore}` : null,
          ].filter((value): value is string => Boolean(value));
          return (
            <div key={gem.catalogId} role="listitem">
              <TitleButton
                title={gem}
                label={`${gem.name}${gem.year ? ` (${gem.year})` : ""}, ${scores.join(", ")}, en ${PLATFORM_SERVICE_LABEL[gem.platform]}`}
                className="act-two-gem"
              >
                {(frameRef) => (
                  <div ref={frameRef} className="act-two-gem-frame">
                    <Image src={gem.backdropUrl} alt="" fill sizes="268px" unoptimized className="act-two-gem-still" />
                    <PlatformLogo platform={gem.platform} size={26} className="act-two-gem-logo rounded-[8px]" />
                    <span className="act-two-gem-text">
                      <span className="act-two-gem-name font-serif">{gem.name}</span>
                      <span className="act-two-gem-scores">
                        {scores.map((score) => (
                          <span key={score} className="act-two-gem-score">
                            {score}
                          </span>
                        ))}
                        {gem.year ? <span>{gem.year}</span> : null}
                      </span>
                    </span>
                  </div>
                )}
              </TitleButton>
            </div>
          );
        })}
      </FadeRail>
    </section>
  );
};

/** «Porque te gustó X» / «Porque elegiste X»: one seed, its recommendations (FIL-I47-4). */
const SeedRailSection = ({ rail }: { rail: SeedRail | null }) => {
  if (!rail) {
    return null;
  }
  const heading = rail.chosen ? "Porque elegiste" : "Porque te gustó";
  return (
    <section className="act-two-block" aria-labelledby="act-two-seed-title" data-act-two="seed">
      <div className="act-two-seed">
        {rail.seedPosterPath ? (
          <div className="act-two-seed-poster" aria-hidden="true">
            <PosterImage name={rail.seedName} posterPath={rail.seedPosterPath} ratio="fill" sizes="34px" />
          </div>
        ) : null}
        <div className="act-two-head !px-0">
          <h2 id="act-two-seed-title" className="font-serif">
            {heading} <em>{rail.seedName}</em>
          </h2>
          <p>Incluidas en tus plataformas</p>
        </div>
      </div>
      <FadeRail label={`${heading} ${rail.seedName}`} className="act-two-rail">
        {rail.titles.map((title) => (
          <div key={title.catalogId} role="listitem">
            <TitleButton title={title} label={`${title.name}${title.year ? ` (${title.year})` : ""}`} className="act-two-seed-tile">
              {(frameRef) => (
                <>
                  <div ref={frameRef} className="act-two-seed-tile-poster">
                    <PosterImage name={title.name} posterPath={title.posterPath} ratio="fill" sizes="98px" />
                    <StatusDot title={title} />
                  </div>
                  <span className="act-two-seed-tile-name">{title.name}</span>
                </>
              )}
            </TitleButton>
          </div>
        ))}
      </FadeRail>
    </section>
  );
};

const LONG_DATE = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Mexico_City",
});

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const WEEKDAY_LONG = new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: "America/Mexico_City" });

const mxDayOf = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export type HoyActTwoProps = {
  userPlatforms: Platform[];
  charts: ServiceChart[];
  arrivals: ArrivalTitle[];
  /** ISO, from the server: the dates on the page match the snapshot. */
  now: string;
  /** What the dock's dot compares (`actTwoStamp`). */
  stamp: string;
  /** «Afina tu gusto» cards and the signal count; null when Hoy already knows enough. */
  afina: { cards: AfinaCard[]; signals: number } | null;
  /** How much Hoy knows (FIL-I47-3): it orders the sections. Null when it could not be counted. */
  signals: number | null;
  gems: ActTwoGem[];
  seedRail: SeedRail | null;
};

/**
 * Hoy's second act (FIL-I47-1): below the sala, what the user's services carry today. Computed
 * by the nightly crons; nothing here calls TMDB.
 */
export const HoyActTwo = ({ userPlatforms, charts, arrivals, now, stamp, afina, signals, gems, seedRail }: HoyActTwoProps) => {
  const date = new Date(now);
  // Seen on Hoy: the dock's dot clears (FIL-I47-2).
  useEffect(() => {
    try {
      window.localStorage.setItem(ACT_TWO_SEEN_KEY, stamp);
    } catch {
      // Private mode: no dot, nothing to clear.
    }
    window.dispatchEvent(new Event(ACT_TWO_SEEN_EVENT));
  }, [stamp]);
  const hasRanking = chartPlatformsFor(userPlatforms, charts).length > 0;
  const netflixOfficial = charts.some((chart) => chart.platform === "NETFLIX" && chart.source === "official");
  const closingLine = netflixOfficial
    ? `El Top 10 de Netflix cambia el ${WEEKDAY_LONG.format(new Date(`${nextOfficialDay(mxDayOf(date))}T18:00:00Z`))}; lo demás, cada mañana. Aquí te esperamos.`
    : "El ranking se actualiza cada mañana. Aquí te esperamos.";
  if (!hasRanking && arrivals.length === 0 && gems.length === 0 && !seedRail) {
    return null;
  }
  const sections: Record<ActTwoSection, ReactNode> = {
    ranking: <ServiceRanking key="ranking" charts={charts} userPlatforms={userPlatforms} />,
    afina: afina ? <AfinaTuGusto key="afina" initialCards={afina.cards} initialSignals={afina.signals} /> : null,
    arrivals: <RecentArrivals key="arrivals" arrivals={arrivals} now={date} />,
    gems: <Gems key="gems" gems={gems} />,
    seed: <SeedRailSection key="seed" rail={seedRail} />,
  };
  return (
    <section id="en-tus-plataformas" className="hoy-act-two" aria-labelledby="act-two-title">
      <header className="act-two-intro">
        <p>{capitalize(LONG_DATE.format(date))}</p>
        <h2 id="act-two-title" className="font-serif">
          En tus plataformas
        </h2>
      </header>
      {actTwoOrder(signals ?? 0).map((section) => sections[section])}
      <footer className="act-two-end">
        <p className="font-serif">Eso es todo por hoy</p>
        <span>{closingLine}</span>
        <small>
          Disponibilidad: datos de{" "}
          <a href="https://www.justwatch.com/mx" target="_blank" rel="noopener noreferrer" className="relative underline-offset-2 hover:underline">
            JustWatch
            <HitArea />
          </a>{" "}
          vía TMDB.
        </small>
      </footer>
    </section>
  );
};
