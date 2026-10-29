"use client";

import Image from "next/image";
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
  SearchResultRow,
  type SearchRowStatus,
  type SearchRowWiring,
} from "@/components/tmdb-search/SearchResultRow";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { staggerStyle } from "@/lib/motion";
import {
  menuRoles,
  PERSON_ROLE_LABEL,
  personYearsLabel,
  todayIso,
  type DirectorHit,
  type FilmographyEntry,
  type PersonFilmography,
  type PersonRole,
} from "@/lib/person-filmography";
import type { SearchResultFacts } from "@/lib/search-result-facts";
import {
  essentialPicks,
  groupByDecade,
  mineSplit,
  PROGRESS_MARKS_MAX,
  shelvesSettled,
  TASTE_SHELF_TITLE,
  tastePicks,
  upcomingSummary,
  watchProgress,
} from "@/lib/person-view";
import { personMineFilterOn, setPersonMineFilter } from "@/lib/search-session";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { tmdbProfileUrl } from "@/lib/tmdb";
import { focusRing, glassPanelClass } from "@/lib/ui";

/** Round TMDB profile photo; no photo, no placeholder. */
const PersonPhoto = ({
  profilePath,
  name,
  className,
  sizes,
}: {
  profilePath: string | null;
  name: string;
  className: string;
  sizes: string;
}) => {
  const src = tmdbProfileUrl(profilePath);
  if (!src) {
    return null;
  }
  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-well ring-1 ring-white/15 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.8)]",
        className,
      )}
    >
      <Image src={src} alt={`Foto de ${name}`} fill sizes={sizes} className="object-cover" unoptimized />
    </span>
  );
};

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

/**
 * One view for any person and role, direction B «Lo esencial» (FIL-I16-4):
 * who they are, how much of their work you have seen, their best by IMDb, the
 * closest to your taste, what is coming, and the whole work by decade, with
 * the appearances that are not their work folded at the end.
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

      <PersonHeader
        key={`${name}:${role}`}
        name={name}
        profilePath={profilePath}
        role={role}
        data={data}
        onSwitchRole={onSwitchRole}
      />

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

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** «títulos · 13 pelis, 4 series», or just «películas» / «series». */
const workKindsLabel = ({ movies, series }: Pick<PersonFilmography, "movies" | "series">) =>
  series === 0
    ? plural(movies, "película", "películas")
    : movies === 0
      ? plural(series, "serie", "series")
      : `títulos · ${movies} ${plural(movies, "peli", "pelis")}, ${series} ${plural(series, "serie", "series")}`;

const PersonStat = ({ value, label }: { value: string; label: string }) => (
  <div className="min-w-0 flex-1 rounded-2xl bg-well px-3 py-2.5">
    <p className="font-serif text-xl leading-tight text-paper">{value}</p>
    <p className="truncate text-[11.5px] text-fog">{label}</p>
  </div>
);

const PersonHeader = ({
  name,
  profilePath,
  role,
  data,
  onSwitchRole,
}: {
  name: string;
  profilePath: string | null;
  role: PersonRole;
  data: PersonFilmography | null;
  onSwitchRole?: (role: PersonRole) => void;
}) => {
  const roles = data ? menuRoles(data) : [role];
  const years = data ? personYearsLabel(data.years) : null;
  return (
    <section aria-label={name || "Persona"} className="person-card-in space-y-4">
      <div className="flex min-w-0 items-center gap-4">
        <PersonPhoto profilePath={profilePath} name={name} className="size-[92px]" sizes="92px" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="line-clamp-2 font-serif text-[30px] leading-[1.05] text-pretty break-words text-paper">
            {name || "…"}
          </h2>
          {data && onSwitchRole && roles.length > 1 ? (
            <RoleMenu role={role} roles={roles} counts={data.roles} onSwitch={onSwitchRole} />
          ) : (
            <p className="text-sm text-paper/80">{PERSON_ROLE_LABEL[role]}</p>
          )}
        </div>
      </div>
      {data && data.entries.length > 0 ? (
        <div className="flex gap-2">
          <PersonStat value={String(data.entries.length)} label={workKindsLabel(data)} />
          {years ? <PersonStat value={years} label="en activo" /> : null}
        </div>
      ) : null}
    </section>
  );
};

/** «Director ▾»: the same person in another role, with the size of each. */
const RoleMenu = ({
  role,
  roles,
  counts,
  onSwitch,
}: {
  role: PersonRole;
  roles: PersonRole[];
  counts: Record<PersonRole, number>;
  onSwitch: (role: PersonRole) => void;
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
          // 40 px tall (FIL-I22-5): a thumb target, not a label.
          "press-scale inline-flex h-10 items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3.5 text-sm text-accent-hover",
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
          className="absolute top-[calc(100%+6px)] left-0 z-30 min-w-[13rem] rounded-2xl border border-line bg-surface p-1.5 shadow-[0_20px_40px_-14px_rgb(0_0_0/0.8)]"
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
  const progress = watchProgress(data.entries, (entry) => statusOf(entry).status);
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
  const upcoming = upcomingSummary(data.upcoming, todayIso());

  return (
    <>
      {progress.total > 0 ? <WatchProgress progress={progress} nudge={Boolean(taste)} /> : null}
      {waiting ? <ShelfSkeleton /> : null}
      {essential.length > 0 ? (
        <PosterShelf
          title="Lo esencial"
          hint="Su mejor calificada en IMDb"
          entries={essential}
          statusOf={statusOf}
          rows={rows}
          meta={(entry, status) => (
            <span className="flex items-center gap-1.5">
              <ImdbBadge rating={factsOf(entry)?.imdbRating} compact />
              {status === "watched" ? <span className="text-xs text-success">La viste</span> : null}
            </span>
          )}
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
          statusOf={statusOf}
          rows={rows}
          factsOf={factsOf}
          hasPlatforms={hasPlatforms}
        />
      ) : null}
      {data.others.length > 0 ? <OtherAppearances entries={data.others} statusOf={statusOf} rows={rows} /> : null}
    </>
  );
};

/** «Has visto 4 de 23 · 2 en Quiero ver», one mark per title (proportional past 40). */
const WatchProgress = ({
  progress,
  nudge,
}: {
  progress: ReturnType<typeof watchProgress>;
  nudge: boolean;
}) => (
  <section aria-label="Tu avance" className={cn(glassPanelClass, "space-y-2 rounded-[20px] px-4 py-3.5")}>
    <div className="flex items-baseline justify-between gap-3">
      <p className="font-serif text-lg text-paper">
        Has visto {progress.watched} de {progress.total}
      </p>
      <p className="shrink-0 text-xs text-fog">{progress.watchlist} en Quiero ver</p>
    </div>
    {progress.total <= PROGRESS_MARKS_MAX ? (
      <div className="flex gap-[3px]" aria-hidden="true">
        {progress.marks.map((mark, index) => (
          <span
            key={index}
            className={cn(
              "h-2 flex-1 rounded-[3px]",
              mark === "watched" ? "bg-success" : mark === "watchlist" ? "ring-[1.5px] ring-accent/70 ring-inset" : "bg-line",
            )}
          />
        ))}
      </div>
    ) : (
      <div className="flex h-2 overflow-hidden rounded-[3px] bg-line" aria-hidden="true">
        <span className="bg-success" style={{ width: `${(progress.watched / progress.total) * 100}%` }} />
        <span className="bg-accent/45" style={{ width: `${(progress.watchlist / progress.total) * 100}%` }} />
      </div>
    )}
    {progress.watched === 0 && nudge ? (
      <p className="text-[13px] text-paper/80">Empieza por la que más se parece a lo que te gusta{"\u00a0"}↓</p>
    ) : null}
  </section>
);

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

/** A horizontal rail of posters that open their ficha. */
const PosterShelf = ({
  title,
  hint,
  tone,
  entries,
  statusOf,
  rows,
  meta,
}: {
  title: string;
  hint: string;
  tone?: "affinity";
  entries: FilmographyEntry[];
  statusOf: StatusOf;
  rows: SearchRowWiring;
  meta: (entry: FilmographyEntry, status: SearchRowStatus) => ReactNode;
}) => (
  <section className="space-y-3">
    <header className="space-y-0.5">
      <h3 className={cn("font-serif text-[21px] leading-tight", tone === "affinity" ? "text-affinity" : "text-paper")}>
        {title}
      </h3>
      <p className="text-[13px] text-fog">{hint}</p>
    </header>
    <ul className="rail rail-fade -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {entries.map((entry) => {
        const { titleId, status } = statusOf(entry);
        return (
          <li key={`${entry.kind}:${entry.tmdbId}`} className="w-[7.5rem] shrink-0 lg:w-[8.5rem]">
            <Link
              href={rows.hrefFor(entry, titleId)}
              prefetch={false}
              onClick={() => rows.onOpen(entry)}
              className={cn("press-scale block space-y-1.5 rounded-xl", focusRing)}
            >
              <PosterImage
                name={entry.name}
                posterPath={entry.posterPath}
                sizes="136px"
                tmdbSize="w342"
                className="rounded-[10px] shadow-[0_14px_30px_-12px_rgb(0_0_0/0.8)]"
              />
              <span className="block truncate font-serif text-sm text-paper">{entry.name}</span>
              {meta(entry, status)}
              <ShelfPlatform facts={rows.factsFor?.(entry) ?? null} />
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

/** Every title of the work, Buscar's rows grouped by decade, filterable by kind and by your platforms. */
const WorkByDecade = ({
  entries,
  role,
  statusOf,
  rows,
  factsOf,
  hasPlatforms,
}: {
  entries: FilmographyEntry[];
  role: PersonRole;
  statusOf: StatusOf;
  rows: SearchRowWiring;
  factsOf: (entry: FilmographyEntry) => SearchResultFacts | null;
  hasPlatforms: boolean;
}) => {
  const [kind, setKind] = useState<KindFilter>("ALL");
  // «En mis plataformas» (FIL-I30-2) stays on from one person to the next.
  const [mine, setMine] = useState(personMineFilterOn);
  const toggleMine = () => {
    setMine(!mine);
    setPersonMineFilter(!mine);
  };
  const mixed = entries.some((entry) => entry.kind === "MOVIE") && entries.some((entry) => entry.kind === "SERIES");
  const ofKind = kind === "ALL" ? entries : entries.filter((entry) => entry.kind === kind);
  const split = mineSplit(ofKind, factsOf);
  const filtering = mine && hasPlatforms;
  const shown = filtering ? split.shown : ofKind;
  const decades = groupByDecade(shown);
  // Where each decade starts in the whole list, for the entrance stagger.
  const starts = decades.map((_, at) => decades.slice(0, at).reduce((sum, group) => sum + group.entries.length, 0));

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-[21px] leading-tight text-paper">Toda su obra</h3>
        {mine && !hasPlatforms ? null : (
          <p className="text-xs text-mist">{shown.length === 1 ? "1 título" : `${shown.length} títulos`}</p>
        )}
      </header>
      <div role="group" aria-label="Filtros" className="flex flex-wrap gap-2">
        {mixed
          ? KIND_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={kind === filter.value}
                onClick={() => setKind(filter.value)}
                className={catalogBarChipClass(kind === filter.value)}
              >
                {filter.label}
              </button>
            ))
          : null}
        <button type="button" aria-pressed={mine} onClick={toggleMine} className={catalogBarChipClass(mine)}>
          En mis plataformas
        </button>
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
      {filtering && shown.length === 0 && split.checking === 0 ? (
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
        <div key={group.decade} className="space-y-2">
          <h4 className="flex items-center gap-2.5 text-xs font-medium tracking-[0.14em] text-faint after:h-px after:flex-1 after:bg-line">
            {group.label}
          </h4>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:gap-3">
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
              className={cn("block truncate rounded text-sm text-fog hover:text-paper", focusRing)}
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
