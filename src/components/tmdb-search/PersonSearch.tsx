"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AffinityChip } from "@/components/affinity/AffinityChip";
import { useNavLabel } from "@/components/NavOriginTracker";
import { Button } from "@/components/Button";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { EmptyState } from "@/components/EmptyState";
import { ImdbBadge } from "@/components/ImdbBadge";
import { PlatformLogo } from "@/components/PlatformLogo";
import { SearchResultsSkeleton } from "@/components/PageSkeletons";
import { PosterImage } from "@/components/PosterImage";
import {
  PersonHero,
  PersonPhoto,
  PersonStickyBar,
  useScrolledPast,
  watchedLine,
  type HeroStat,
} from "@/components/tmdb-search/PersonHero";
import { PersonJourney } from "@/components/tmdb-search/PersonJourney";
import { PersonOscars } from "@/components/tmdb-search/PersonOscars";
import {
  SearchResultRow,
  type SearchRowStatus,
  type SearchRowWiring,
} from "@/components/tmdb-search/SearchResultRow";
import { cn } from "@/lib/cn";
import { formatStarScore, PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { staggerStyle } from "@/lib/motion";
import {
  menuRoles,
  PERSON_ROLE_LABEL,
  todayIso,
  type DirectorHit,
  type FilmographyEntry,
  type PersonFilmography,
  type PersonRole,
} from "@/lib/person-filmography";
import type { SearchResultFacts } from "@/lib/search-result-facts";
import {
  decadeChart,
  essentialPicks,
  groupByDecade,
  mineSplit,
  nextForYou,
  shelvesSettled,
  TASTE_SHELF_TITLE,
  tastePicks,
  thirdStat,
  upcomingSummary,
  watchedStrip,
  watchProgress,
} from "@/lib/person-view";
import { personMineFilterOn, setPersonMineFilter } from "@/lib/search-session";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { focusRing, glassPanelClass } from "@/lib/ui";

/** «David Fincher · Director — Ver filmografía ›» on top of Todos / Películas / Series. */
export const DirectorSuggestion = ({
  director,
  onOpen,
}: {
  director: DirectorHit;
  onOpen: (director: DirectorHit) => void;
}) => (
  <button
    type="button"
    onClick={() => onOpen(director)}
    className={cn(
      glassPanelClass,
      "person-card-in press-scale flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:border-accent/40",
      focusRing,
    )}
  >
    <PersonPhoto
      profilePath={director.profilePath}
      name={director.name}
      className="size-11"
      sizes="44px"
    />
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium text-paper">
        {director.name} <span className="font-normal text-fog">· Director</span>
      </span>
      <span className="block text-sm text-accent">Ver filmografía</span>
    </span>
    <span aria-hidden="true" className="shrink-0 text-accent">
      ›
    </span>
  </button>
);

/** A homonym TMDB knows nothing about: no photo, no popularity (FIL-I22-7). */
const isObscure = (director: DirectorHit) => director.profilePath === null && director.popularity < 1;

/** Director chip with several (or loose) matches: pick one; the obscure homonyms go last, in gray. */
export const DirectorPicker = ({
  directors,
  onOpen,
}: {
  directors: DirectorHit[];
  onOpen: (director: DirectorHit) => void;
}) => (
  <section className="space-y-3">
    <header className="flex items-end justify-between">
      <h2 className="text-lg font-semibold text-paper">Directores</h2>
      <p className="text-sm text-mist">{directors.length}</p>
    </header>
    <ul className="space-y-2">
      {[...directors.filter((d) => !isObscure(d)), ...directors.filter(isObscure)].map((director, index) => (
        <li key={director.id} className="stagger-in" style={staggerStyle(index)} data-director={isObscure(director) ? "obscure" : "known"}>
          <button
            type="button"
            onClick={() => onOpen(director)}
            className={cn(
              "group card-physics press-scale flex w-full min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left hover:border-accent/40",
              focusRing,
            )}
          >
            <PersonPhoto
              profilePath={director.profilePath}
              name={director.name}
              className="size-12"
              sizes="48px"
            />
            <span className="min-w-0 flex-1">
              <span className={cn("line-clamp-2 font-medium leading-snug", isObscure(director) ? "text-fog" : "text-paper")}>
                {director.name}
              </span>
              <span className="block text-sm text-fog">{isObscure(director) ? "Director · sin foto" : "Director"}</span>
            </span>
            <span className="shrink-0 text-mist" aria-hidden="true">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  </section>
);

export type PersonViewState =
  | { kind: "ready"; data: PersonFilmography }
  | { kind: "error"; error: string; personId: number; role: PersonRole; name: string | null };

type StatusOf = (result: TmdbCatalogResult) => { titleId: string | null; status: SearchRowStatus };

type PersonViewProps = {
  state: PersonViewState | null;
  /** Painted from the tap while the filmography loads. */
  pending: { name: string; profilePath: string | null; role: PersonRole } | null;
  statusOf: StatusOf;
  /** `factsFor` here answers for the whole filmography (FIL-I16-1). */
  rows: SearchRowWiring;
  onRetry: () => void;
  /** «‹ Resultados»: only when there is a search to go back to. */
  backLabel: string | null;
  onBack: () => void;
  /** Without a search behind: «‹ Obsesión» back to the page that opened this view (FIL-I4-6). */
  originBack?: ReactNode;
  /** The role menu: the same person in another role (same page, no new history entry). */
  onSwitchRole?: (role: PersonRole) => void;
  /** The user saved streaming platforms in Perfil: «En mis plataformas» can filter (FIL-I30-2). */
  hasPlatforms?: boolean;
};

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** «32 pelis · 8 series», or just «películas» / «series». */
const workKindsLabel = ({ movies, series }: Pick<PersonFilmography, "movies" | "series">) =>
  series === 0
    ? plural(movies, "película", "películas")
    : movies === 0
      ? plural(series, "serie", "series")
      : `${movies} ${plural(movies, "peli", "pelis")} · ${series} ${plural(series, "serie", "series")}`;

/** Years in activity as one number («61») when it is a span, else the year itself. */
const activeYears = (years: PersonFilmography["years"]) =>
  !years ? null : years.from === years.to ? { value: String(years.from), label: "en activo" } : { value: String(years.to - years.from + 1), label: "años en activo" };

/** The phone header (Filmia + the search row) covers this many px; the name is gone past it. */
const STICKY_OFFSET = 124;

/**
 * One view for any person and role, «Tu recorrido» v3 (FIL-I45): the poster-wall hero with three
 * numbers, how much of the work you have seen and which (ring + film strip), what to watch next,
 * their Óscar as tickets, their best by IMDb, the closest to your taste, what is coming, and the whole
 * work by decade with Todo / Vistas / Sin ver, the appearances that are not their work folded last.
 */
export const PersonView = ({
  state,
  pending,
  statusOf,
  rows,
  onRetry,
  backLabel,
  onBack,
  originBack = null,
  onSwitchRole,
  hasPlatforms = false,
}: PersonViewProps) => {
  const data = !pending && state?.kind === "ready" ? state.data : null;
  const name = pending?.name ?? data?.person.name ?? (state?.kind === "error" ? state.name : null) ?? "";
  const profilePath = pending?.profilePath ?? data?.person.profilePath ?? null;
  const role = pending?.role ?? data?.role ?? (state?.kind === "error" ? state.role : "director");
  // A ficha opened from this filmography says «‹ Greg Daniels».
  useNavLabel(name || null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const scrolledPast = useScrolledPast(nameRef, STICKY_OFFSET);

  const progress = data ? watchProgress(data.entries, (entry) => statusOf(entry).status) : null;
  const gold = Boolean(data?.oscars && data.oscars.wins.length > 0);
  const factsOf = (entry: FilmographyEntry) => rows.factsFor?.(entry) ?? null;
  const stats: HeroStat[] = [];
  if (data && data.entries.length > 0) {
    stats.push({ value: String(data.entries.length), label: workKindsLabel(data) });
    const years = activeYears(data.years);
    if (years) {
      stats.push(years);
    }
    const third = thirdStat(data.oscars, data.entries, factsOf);
    if (third) {
      stats.push({ value: String(third.value), label: third.label, tone: third.tone === "gold" ? "gold" : undefined });
    }
  }
  const roles = data ? menuRoles(data) : [role];
  const otherRoles = data
    ? roles.filter((option) => option !== role && data.roles[option] > 0).map((option) => `${PERSON_ROLE_LABEL[option].toLowerCase()} · ${data.roles[option]}`)
    : [];
  const roleMenu = (where: "hero" | "bar") =>
    data && onSwitchRole && roles.length > 1 ? (
      <span className="inline-flex items-center gap-2.5">
        <RoleMenu role={role} roles={roles} counts={data.roles} onSwitch={onSwitchRole} align={where === "bar" ? "right" : "left"} />
        {where === "hero" && otherRoles.length > 0 ? (
          <span className="text-[12.5px] text-fog">También {otherRoles.join(", ")}</span>
        ) : null}
      </span>
    ) : null;

  return (
    <div className="space-y-6">
      {!backLabel ? originBack : null}
      {backLabel ? (
        <button
          type="button"
          onClick={onBack}
          className={cn(
            // On phones the dock's disc is the one «atrás» (FIL-I22-6); the text link stays for desktop.
            "press-scale -ml-1 hidden max-w-full items-center gap-1 rounded-full px-1 text-sm text-fog hover:text-paper sm:inline-flex",
            focusRing,
          )}
        >
          <span aria-hidden="true">‹</span>
          <span className="truncate">{backLabel}</span>
        </button>
      ) : null}

      <PersonHero
        key={`${name}:${role}`}
        name={name}
        profilePath={profilePath}
        role={role}
        data={data}
        stats={stats}
        gold={gold}
        nameRef={nameRef}
        roleMenu={roleMenu("hero")}
      />
      {name ? (
        <PersonStickyBar
          visible={scrolledPast}
          name={name}
          profilePath={profilePath}
          gold={gold}
          line={watchedLine(role, progress?.watched ?? 0, progress?.total ?? 0)}
          roleMenu={roleMenu("bar")}
        />
      ) : null}

      {pending || !state ? (
        <SearchResultsSkeleton />
      ) : state.kind === "error" ? (
        <div className="space-y-3 rounded-2xl border border-danger-line bg-danger-well px-4 py-8 text-center">
          <h3 className="font-serif text-2xl text-paper">No se pudo cargar</h3>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-fog">{state.error}</p>
          <Button type="button" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : state.data.entries.length + state.data.upcoming.length + state.data.others.length === 0 ? (
        <EmptyState
          variant="buscar"
          title="Sin títulos para mostrar"
          description="TMDB todavía no tiene créditos de esta persona en este rol."
        />
      ) : (
        <PersonBody data={state.data} statusOf={statusOf} rows={rows} hasPlatforms={hasPlatforms} />
      )}
    </div>
  );
};


/** «Director ▾»: the same person in another role, with the size of each. */
const RoleMenu = ({
  role,
  roles,
  counts,
  onSwitch,
  align = "left",
}: {
  role: PersonRole;
  roles: PersonRole[];
  counts: Record<PersonRole, number>;
  onSwitch: (role: PersonRole) => void;
  /** The sticky bar opens it toward the left edge. */
  align?: "left" | "right";
}) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          // 44 px tall (FIL-I45-6): a thumb target, not a label.
          "press-scale inline-flex h-11 items-center gap-1.5 rounded-full border border-accent/55 bg-accent/14 px-3.5 text-sm text-accent-hover backdrop-blur-md",
          focusRing,
        )}
      >
        {PERSON_ROLE_LABEL[role]}
        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Rol"
          className={cn("absolute top-[calc(100%+6px)] z-40", align === "right" ? "right-0" : "left-0", "min-w-[13rem] rounded-2xl border border-line bg-surface p-1.5 shadow-[0_20px_40px_-14px_rgb(0_0_0/0.8)]")}
        >
          {roles.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === role}
              onClick={() => {
                setOpen(false);
                if (option !== role) {
                  onSwitch(option);
                }
              }}
              className={cn(
                "flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left text-sm",
                option === role ? "bg-white/8 text-paper" : "text-paper/80 hover:bg-white/5",
                focusRing,
              )}
            >
              <span>{PERSON_ROLE_LABEL[option]}</span>
              <span className="text-fog">{counts[option]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const PersonBody = ({
  data,
  statusOf,
  rows,
  hasPlatforms,
}: {
  data: PersonFilmography;
  statusOf: StatusOf;
  rows: SearchRowWiring;
  hasPlatforms: boolean;
}) => {
  const factsOf = (entry: FilmographyEntry) => rows.factsFor?.(entry) ?? null;
  const statusOnly = (entry: FilmographyEntry) => statusOf(entry).status;
  const progress = watchProgress(data.entries, statusOnly);
  // Until the facts settle, the shelves keep their place; then they are drawn once and kept,
  // so a rating that lands later never swaps a poster (FIL-I30-4).
  const waiting = data.entries.length > 0 && !shelvesSettled(data.entries, factsOf);
  const shelvesKey = `${data.person.id}:${data.role}`;
  const [shelves, setShelves] = useState<{
    key: string;
    essential: FilmographyEntry[];
    taste: ReturnType<typeof tastePicks>;
  } | null>(null);
  if (!waiting && shelves?.key !== shelvesKey) {
    setShelves({ key: shelvesKey, essential: essentialPicks(data.entries, factsOf), taste: tastePicks(data.entries, factsOf) });
  }
  const drawn = !waiting && shelves?.key === shelvesKey ? shelves : null;
  const essential = drawn?.essential ?? [];
  const taste = drawn?.taste ?? null;
  const today = todayIso();
  const upcoming = upcomingSummary(data.upcoming, today);
  const strip = watchedStrip(data.entries, statusOnly, factsOf);
  const next = drawn ? nextForYou(taste, essential, statusOnly) : null;
  const essentialSeen = essential.filter((entry) => statusOnly(entry) === "watched").length;

  return (
    <>
      {progress.total > 0 ? (
        <PersonJourney progress={progress} strip={strip} next={next} statusOf={statusOf} rows={rows} today={today} />
      ) : null}
      {/* The person's Óscar (FIL-I43), as tickets on an axis since FIL-I45-4. */}
      {data.oscars ? <PersonOscars key={data.person.id} oscars={data.oscars} /> : null}
      {waiting ? <ShelfSkeleton /> : null}
      {essential.length > 0 ? (
        <PosterShelf
          eyebrow="Por dónde empezar"
          title="Lo esencial"
          hint="Su mejor calificada en IMDb"
          badge={essentialSeen > 0 ? `${essentialSeen} de ${essential.length} vistas` : null}
          size="large"
          entries={essential}
          statusOf={statusOf}
          rows={rows}
        />
      ) : null}
      {taste ? (
        <PosterShelf
          title={TASTE_SHELF_TITLE[taste.level]}
          hint="Lo más cerca de tu gusto que no has visto"
          tone="affinity"
          entries={taste.entries}
          statusOf={statusOf}
          rows={rows}
          meta={(entry) => {
            const affinity = factsOf(entry)?.affinity;
            return affinity ? (
              <AffinityChip level={affinity.level} label={affinity.label} lowConfidence={affinity.lowConfidence} />
            ) : null;
          }}
        />
      ) : null}
      {upcoming ? <UpcomingCard summary={upcoming} statusOf={statusOf} rows={rows} /> : null}
      {data.entries.length > 0 ? (
        <WorkByDecade
          entries={data.entries}
          role={data.role}
          years={data.years}
          statusOf={statusOf}
          rows={rows}
          factsOf={factsOf}
          hasPlatforms={hasPlatforms}
          progress={progress}
          next={next?.entry ?? null}
          today={today}
        />
      ) : null}
      {data.others.length > 0 ? <OtherAppearances entries={data.others} statusOf={statusOf} rows={rows} /> : null}
    </>
  );
};


/** The shelf's streaming line: your platform with its logo, otherwise the first MX subscription. */
const ShelfPlatform = ({ facts }: { facts: SearchResultFacts | null }) => {
  if (!facts || facts.providersPending) {
    return null;
  }
  if (facts.minePlatform) {
    return (
      <span className="flex min-w-0 items-center gap-1 text-[11px] text-paper/90">
        <PlatformLogo platform={facts.minePlatform} size={12} className="rounded-[3px]" />
        <span className="truncate">{PLATFORM_SERVICE_LABEL[facts.minePlatform]}</span>
      </span>
    );
  }
  if (!facts.platform) {
    return null;
  }
  return <span className="block truncate text-[11px] text-paper/75">{facts.platform}</span>;
};

/** The ribbon across a watched poster's corner. */
const SeenRibbon = () => (
  <span
    className="pointer-events-none absolute top-4 -left-9 w-[140px] -rotate-45 bg-linear-to-r from-success to-[#9ff0c9] py-[3px] text-center text-[9.5px] font-semibold tracking-[0.22em] text-ink uppercase shadow-[0_4px_12px_rgb(0_0_0/0.5)]"
    aria-hidden="true"
  >
    Vista
  </span>
);

/** A horizontal rail of posters that open their ficha; «large» puts IMDb, your stars and «Vista» on the poster. */
const PosterShelf = ({
  eyebrow,
  title,
  hint,
  badge = null,
  tone,
  size = "regular",
  entries,
  statusOf,
  rows,
  meta,
}: {
  eyebrow?: string;
  title: string;
  hint: string;
  badge?: string | null;
  tone?: "affinity";
  size?: "regular" | "large";
  entries: FilmographyEntry[];
  statusOf: StatusOf;
  rows: SearchRowWiring;
  meta?: (entry: FilmographyEntry, status: SearchRowStatus) => ReactNode;
}) => (
  <section className="space-y-3.5">
    <header className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[10.5px] font-medium tracking-[0.22em] text-fog uppercase">{eyebrow}</p> : null}
        <h3
          className={cn(
            "font-serif leading-[1.05] tracking-[-0.015em]",
            eyebrow ? "mt-1.5 text-[27px]" : "text-[23px]",
            tone === "affinity" ? "text-affinity" : "text-paper",
          )}
        >
          {title}
        </h3>
        <p className="mt-1 font-serif text-[14px] text-fog italic">{hint}</p>
      </div>
      {badge ? (
        <span className="mb-1 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-success/25 bg-success-well px-2.5 text-xs font-medium text-success">
          <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
            <path d="M8 2a6 6 0 0 1 5.2 3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {badge}
        </span>
      ) : null}
    </header>
    <ul className="rail rail-fade -mx-4 flex gap-3.5 overflow-x-auto px-4 pt-1 pb-1 sm:mx-0 sm:px-0">
      {entries.map((entry) => {
        const { titleId, status } = statusOf(entry);
        const facts = rows.factsFor?.(entry) ?? null;
        const large = size === "large";
        return (
          <li key={`${entry.kind}:${entry.tmdbId}`} className={cn("shrink-0", large ? "w-[8.75rem]" : "w-[7.5rem] lg:w-[8.5rem]")}>
            <Link
              href={rows.hrefFor(entry, titleId)}
              prefetch={false}
              onClick={() => rows.onOpen(entry)}
              className={cn("press-scale block space-y-1.5 rounded-xl", focusRing)}
            >
              <span className="relative block overflow-hidden rounded-[12px] shadow-[0_18px_36px_-14px_rgb(0_0_0/0.9)]">
                <PosterImage name={entry.name} posterPath={entry.posterPath} sizes={large ? "140px" : "136px"} tmdbSize="w342" />
                {status === "watched" ? <SeenRibbon /> : null}
                {large && (facts?.imdbRating != null || facts?.watched?.rating != null) ? (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-lg bg-canvas/72 px-1.5 py-1 backdrop-blur-md">
                    {facts?.imdbRating != null ? <ImdbBadge rating={facts.imdbRating} compact /> : null}
                    {facts?.watched?.rating != null ? (
                      <span className="text-xs font-semibold text-star">★ {formatStarScore(facts.watched.rating)}</span>
                    ) : null}
                  </span>
                ) : null}
              </span>
              <span className={cn("block font-serif text-paper", large ? "line-clamp-2 text-[15px] leading-snug" : "truncate text-sm")}>
                {entry.name}
              </span>
              {meta ? meta(entry, status) : null}
              {large ? null : <ShelfPlatform facts={facts} />}
            </Link>
          </li>
        );
      })}
    </ul>
  </section>
);


const ShelfSkeleton = () => (
  <div className="space-y-3" aria-hidden="true">
    <span className="shimmer block h-6 w-32 rounded-full" />
    <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:px-0">
      {[0, 1, 2].map((index) => (
        <span key={index} className="shimmer block aspect-[2/3] w-[7.5rem] shrink-0 rounded-[10px] lg:w-[8.5rem]" />
      ))}
    </div>
  </div>
);

const UpcomingCard = ({
  summary,
  statusOf,
  rows,
}: {
  summary: NonNullable<ReturnType<typeof upcomingSummary>>;
  statusOf: StatusOf;
  rows: SearchRowWiring;
}) => {
  const { entry, when, more } = summary;
  return (
    <Link
      href={rows.hrefFor(entry, statusOf(entry).titleId)}
      prefetch={false}
      onClick={() => rows.onOpen(entry)}
      className={cn(
        glassPanelClass,
        "press-scale flex min-w-0 items-center gap-3 rounded-[18px] bg-linear-to-r from-accent/12 to-transparent p-3",
        focusRing,
      )}
    >
      <span className="w-12 shrink-0 overflow-hidden rounded-md">
        <PosterImage name={entry.name} posterPath={entry.posterPath} sizes="48px" tmdbSize="w185" />
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block text-[11px] font-medium tracking-[0.2em] text-accent-hover uppercase">
          Próximamente · {when}
        </span>
        <span className="line-clamp-2 font-serif text-base leading-snug text-paper">{entry.name}</span>
        {more ? <span className="block text-xs text-fog">{more}</span> : null}
      </span>
    </Link>
  );
};

type KindFilter = "ALL" | "MOVIE" | "SERIES";
const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "ALL", label: "Todo" },
  { value: "MOVIE", label: "Películas" },
  { value: "SERIES", label: "Series" },
];

type SeenFilter = "ALL" | "SEEN" | "UNSEEN";

/** The work by decade as bars: total height, what you watched in green on top; a tap jumps to it. */
const DecadeChart = ({
  bars,
  onJump,
}: {
  bars: ReturnType<typeof decadeChart>;
  onJump: (decade: number) => void;
}) => {
  const top = Math.max(1, ...bars.map((bar) => bar.total));
  return (
    <div role="group" aria-label="Por década" className="-mx-4 flex items-end gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {[...bars].map((bar) => (
        <button
          key={bar.decade}
          type="button"
          onClick={() => onJump(bar.decade)}
          aria-label={`${bar.label}: ${bar.total} ${plural(bar.total, "título", "títulos")}${bar.watched > 0 ? `, ${bar.watched} ${plural(bar.watched, "vista", "vistas")}` : ""}`}
          className={cn("press-scale flex min-h-11 min-w-11 flex-1 flex-col items-center gap-1.5 rounded-lg pt-1", focusRing)}
        >
          <span className="flex h-14 w-full flex-col justify-end gap-0.5" aria-hidden="true">
            <span className="block w-full rounded-[3px] bg-chrome" style={{ height: `${Math.max(6, ((bar.total - bar.watched) / top) * 52)}px` }} />
            {bar.watched > 0 ? (
              <span
                className="block w-full rounded-[3px] bg-success shadow-[0_0_10px_rgb(61_214_140/0.5)]"
                style={{ height: `${Math.max(6, (bar.watched / top) * 52)}px` }}
              />
            ) : null}
          </span>
          <span className="text-[11px] font-semibold text-paper">{bar.label}</span>
          <span className={cn("text-[10px] whitespace-nowrap", bar.watched > 0 ? "text-success" : "text-fog")}>
            {bar.watched > 0 ? `${bar.total} · ${bar.watched} ${plural(bar.watched, "vista", "vistas")}` : bar.total}
          </span>
        </button>
      ))}
    </div>
  );
};

/** Every title of the work: decade bars, Todo / Vistas / Sin ver, kind and platform chips, editorial rows by decade. */
const WorkByDecade = ({
  entries,
  role,
  years,
  statusOf,
  rows,
  factsOf,
  hasPlatforms,
  progress,
  next,
  today,
}: {
  entries: FilmographyEntry[];
  role: PersonRole;
  years: PersonFilmography["years"];
  statusOf: StatusOf;
  rows: SearchRowWiring;
  factsOf: (entry: FilmographyEntry) => SearchResultFacts | null;
  hasPlatforms: boolean;
  progress: ReturnType<typeof watchProgress>;
  next: FilmographyEntry | null;
  today: string;
}) => {
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [seen, setSeen] = useState<SeenFilter>("ALL");
  // «En mis plataformas» (FIL-I30-2) stays on from one person to the next.
  const [mine, setMine] = useState(personMineFilterOn);
  const toggleMine = () => {
    setMine(!mine);
    setPersonMineFilter(!mine);
  };
  const isSeen = (entry: FilmographyEntry) => statusOf(entry).status === "watched";
  const mixed = entries.some((entry) => entry.kind === "MOVIE") && entries.some((entry) => entry.kind === "SERIES");
  const ofSeen = seen === "ALL" ? entries : entries.filter((entry) => (seen === "SEEN" ? isSeen(entry) : !isSeen(entry)));
  const ofKind = kind === "ALL" ? ofSeen : ofSeen.filter((entry) => entry.kind === kind);
  const split = mineSplit(ofKind, factsOf);
  const filtering = mine && hasPlatforms;
  const shown = filtering ? split.shown : ofKind;
  const decades = groupByDecade(shown);
  const bars = decadeChart(entries, (entry) => statusOf(entry).status);
  // Where each decade starts in the whole list, for the entrance stagger.
  const starts = decades.map((_, at) => decades.slice(0, at).reduce((sum, group) => sum + group.entries.length, 0));
  const jump = (decade: number) => {
    if (!decades.some((group) => group.decade === decade)) {
      setSeen("ALL");
      setKind("ALL");
    }
    requestAnimationFrame(() => {
      document.getElementById(`persona-decada-${decade}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };
  const tabs: { value: SeenFilter; label: string; count: number }[] = [
    { value: "ALL", label: "Todo", count: progress.total },
    { value: "SEEN", label: "Vistas", count: progress.watched },
    { value: "UNSEEN", label: "Sin ver", count: progress.total - progress.watched },
  ];

  return (
    <section className="space-y-4" aria-labelledby="persona-obra">
      <header className="flex items-end justify-between gap-3">
        <div>
          {years ? (
            <p className="text-[10.5px] font-medium tracking-[0.22em] text-fog uppercase">
              {years.from === years.to ? years.from : `${years.from} – ${years.to}`}
            </p>
          ) : null}
          <h3 id="persona-obra" className="mt-1.5 font-serif text-[27px] leading-[1.05] tracking-[-0.015em] text-paper">
            Toda su obra
          </h3>
        </div>
        {mine && !hasPlatforms ? null : (
          <p className="mb-1 font-serif text-[14px] text-fog italic">{shown.length === 1 ? "1 título" : `${shown.length} títulos`}</p>
        )}
      </header>
      {bars.length > 1 ? <DecadeChart bars={bars} onJump={jump} /> : null}
      <div className="sticky top-[calc(11.75rem+env(safe-area-inset-top))] z-20 -mx-4 space-y-2.5 bg-canvas/92 px-4 py-2 backdrop-blur sm:top-[calc(11.5rem+env(safe-area-inset-top))] sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Vistas" className="flex gap-0.5 rounded-full border border-line bg-[#0b0d10] p-[3px] shadow-[inset_0_2px_8px_rgb(0_0_0/0.6)]">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={seen === tab.value}
              onClick={() => setSeen(tab.value)}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium transition-[background-color,color,box-shadow] duration-[var(--duration-hover)]",
                seen === tab.value
                  ? "bg-linear-to-b from-[#242b33] to-surface text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_6px_18px_-8px_rgb(0_0_0/0.9)]"
                  : "text-fog hover:text-paper",
                focusRing,
              )}
            >
              {tab.label}
              <span className={cn("text-[11px]", tab.value === "SEEN" && tab.count > 0 ? "text-success" : "text-fog")}>{tab.count}</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filtros" className="flex flex-wrap gap-2">
          {mixed
            ? KIND_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={kind === filter.value}
                  onClick={() => setKind(filter.value)}
                  className={cn(catalogBarChipClass(kind === filter.value), "min-h-11")}
                >
                  {filter.label}
                </button>
              ))
            : null}
          <button type="button" aria-pressed={mine} onClick={toggleMine} className={cn(catalogBarChipClass(mine), "min-h-11")}>
            En mis plataformas
          </button>
        </div>
      </div>
      {mine && !hasPlatforms ? (
        <MinePanel
          title="Aún no eliges tus plataformas"
          description="Dinos cuáles tienes y aquí verás solo lo que puedes ver hoy."
          action={
            <Button href="/perfil#plataformas" variant="secondary">
              Elegir mis plataformas
            </Button>
          }
        />
      ) : null}
      {filtering && (split.checking > 0 || split.unknown > 0) ? (
        <p aria-live="polite" className="text-xs text-fog">
          {split.checking > 0
            ? `Revisando ${split.checking} ${plural(split.checking, "título", "títulos")}…`
            : `${split.unknown} sin datos de plataformas`}
        </p>
      ) : null}
      {seen === "SEEN" && progress.watched === 0 ? (
        <MinePanel
          title="Aún no has visto nada de su obra"
          description={next ? `Empieza por «${next.name}».` : "Cuando marques una como vista, aparecerá aquí."}
          action={
            next ? (
              <Button href={rows.hrefFor(next, statusOf(next).titleId)} variant="secondary">
                Ver «{next.name}»
              </Button>
            ) : null
          }
        />
      ) : seen === "UNSEEN" && progress.total > 0 && progress.watched >= progress.total ? (
        <MinePanel title="Viste toda su obra" description="No te falta ninguno de sus títulos en este rol." action={null} />
      ) : filtering && shown.length === 0 && split.checking === 0 ? (
        <MinePanel
          title="Nada de su obra está en tus plataformas hoy"
          description="Rentar o comprar no cuenta: solo lo incluido en tu suscripción."
          action={
            <Button type="button" variant="secondary" onClick={toggleMine}>
              Ver toda su obra
            </Button>
          }
        />
      ) : null}
      {mine && !hasPlatforms ? null : decades.map((group, groupIndex) => (
        <div key={group.decade} id={`persona-decada-${group.decade}`} className="scroll-mt-[calc(19.5rem+env(safe-area-inset-top))] space-y-1">
          <h4 className="flex items-center gap-2.5 text-xs font-medium tracking-[0.14em] text-faint after:h-px after:flex-1 after:bg-line">
            {group.label}
          </h4>
          <ul className="divide-y divide-white/6 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:divide-y-0">
            {group.entries.map((entry, entryIndex) => {
              const { titleId, status } = statusOf(entry);
              // The first rows of the view stagger in; later ones are already there when scrolled to.
              const order = Math.min(starts[groupIndex]! + entryIndex, STAGGER_ROWS);
              return (
                <li key={`${entry.kind}:${entry.tmdbId}`} className="stagger-in" style={staggerStyle(order)}>
                  <SearchResultRow
                    result={entry}
                    titleId={titleId}
                    status={status}
                    detail={role === "reparto" && entry.character ? entry.character : null}
                    facts={rows.factsFor?.(entry) ?? null}
                    href={rows.hrefFor(entry, titleId)}
                    onOpen={rows.onOpen}
                    onMenu={rows.onMenu}
                    log={rows.logFor?.(entry) ?? null}
                    pinned={titleId !== null && titleId === rows.pinnedTitleId}
                    variant="editorial"
                    today={today}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
};


/** «En mis plataformas» with nothing to list: why, and the way out. */
const MinePanel = ({ title, description, action }: { title: string; description: string; action: ReactNode }) => (
  <div className="space-y-3 rounded-2xl border border-line bg-well/60 px-4 py-6 text-center">
    <h4 className="font-serif text-lg text-paper">{title}</h4>
    <p className="mx-auto max-w-sm text-sm leading-relaxed text-fog">{description}</p>
    {action}
  </div>
);

/** Rows past this one enter with the last delay: a long filmography never waits seconds. */
const STAGGER_ROWS = 8;

/** Appearances that are not the work: folded, plain text, each still opens its ficha. */
const OtherAppearances = ({
  entries,
  statusOf,
  rows,
}: {
  entries: FilmographyEntry[];
  statusOf: StatusOf;
  rows: SearchRowWiring;
}) => {
  const videos = entries.every((entry) => entry.aside === "video");
  const what = videos ? plural(entries.length, "videoclip", "videoclips") : plural(entries.length, "aparición", "apariciones");
  return (
    <details className="group rounded-2xl border border-line bg-well/60 px-4 py-3">
      <summary className={cn("cursor-pointer list-none rounded-md text-sm text-paper/80 marker:hidden", focusRing)}>
        <span className="flex items-center justify-between gap-3">
          <span>
            Otras apariciones · {entries.length} {what}
          </span>
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <ul className="mt-3 space-y-2">
        {entries.map((entry) => (
          <li key={`${entry.kind}:${entry.tmdbId}`}>
            <Link
              href={rows.hrefFor(entry, statusOf(entry).titleId)}
              prefetch={false}
              onClick={() => rows.onOpen(entry)}
              className={cn("flex min-h-11 items-center truncate rounded text-sm text-fog hover:text-paper", focusRing)}
            >
              {entry.name}
              {entry.year ? <span className="text-faint"> · {entry.year}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
};
