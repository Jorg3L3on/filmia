"use client";

import Image from "next/image";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { SearchResultsSkeleton } from "@/components/PageSkeletons";
import { SearchResultRow, type SearchRowStatus } from "@/components/tmdb-search/SearchResultRow";
import { cn } from "@/lib/cn";
import { staggerStyle } from "@/lib/motion";
import {
  PERSON_ROLE_LABEL,
  personRoleLine,
  personYearsLabel,
  type DirectorHit,
  type FilmographyEntry,
  type PersonFilmography,
  type PersonRole,
} from "@/lib/person-filmography";
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

/** Director chip with several (or loose) matches: pick one. */
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
      {directors.map((director, index) => (
        <li key={director.id} className="stagger-in" style={staggerStyle(index)}>
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
              <span className="line-clamp-2 font-medium leading-snug text-paper">{director.name}</span>
              <span className="block text-sm text-fog">Director</span>
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

type PersonViewProps = {
  state: PersonViewState | null;
  /** Painted from the tap while the filmography loads. */
  pending: { name: string; profilePath: string | null; role: PersonRole } | null;
  statusOf: (result: TmdbCatalogResult) => { titleId: string | null; status: SearchRowStatus };
  onPreview: (result: TmdbCatalogResult) => void;
  onRetry: () => void;
  /** «‹ Resultados»: only when there is a search to go back to. */
  backLabel: string | null;
  onBack: () => void;
};

/**
 * One view for any person and role: glass card (photo, name, role line,
 * years) and the filmography with Buscar's own rows and preview sheet.
 */
export const PersonView = ({
  state,
  pending,
  statusOf,
  onPreview,
  onRetry,
  backLabel,
  onBack,
}: PersonViewProps) => {
  const data = !pending && state?.kind === "ready" ? state.data : null;
  const name = pending?.name ?? data?.person.name ?? (state?.kind === "error" ? state.name : null) ?? "";
  const profilePath = pending?.profilePath ?? data?.person.profilePath ?? null;
  const role = pending?.role ?? data?.role ?? (state?.kind === "error" ? state.role : "director");
  const years = data ? personYearsLabel(data.years) : null;

  return (
    <div className="space-y-5">
      {backLabel ? (
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "press-scale -ml-1 inline-flex max-w-full items-center gap-1 rounded-full px-1 text-sm text-fog hover:text-paper",
            focusRing,
          )}
        >
          <span aria-hidden="true">‹</span>
          <span className="truncate">{backLabel}</span>
        </button>
      ) : null}

      <section
        key={`${name}:${role}`}
        aria-label={name || "Persona"}
        className={cn(glassPanelClass, "person-card-in flex min-w-0 items-center gap-4 rounded-3xl p-4")}
      >
        <PersonPhoto profilePath={profilePath} name={name} className="size-20" sizes="80px" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="line-clamp-2 font-serif text-2xl leading-tight text-pretty break-words text-paper">
            {name || "…"}
          </h2>
          {data ? (
            <p className="text-sm text-fog">
              {personRoleLine(data)}
              {years ? <span className="text-mist"> · {years}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-fog">{PERSON_ROLE_LABEL[role]}</p>
          )}
        </div>
      </section>

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
      ) : state.data.entries.length === 0 ? (
        <EmptyState
          variant="buscar"
          title="Sin títulos para mostrar"
          description="TMDB todavía no tiene créditos de esta persona en este rol."
        />
      ) : (
        <FilmographyList
          entries={state.data.entries}
          role={state.data.role}
          statusOf={statusOf}
          onPreview={onPreview}
        />
      )}
    </div>
  );
};

const FilmographyList = ({
  entries,
  role,
  statusOf,
  onPreview,
}: {
  entries: FilmographyEntry[];
  role: PersonRole;
  statusOf: PersonViewProps["statusOf"];
  onPreview: (result: TmdbCatalogResult) => void;
}) => (
  <section className="space-y-3">
    <header className="flex items-end justify-between">
      <h3 className="text-lg font-semibold text-paper">Filmografía</h3>
      <p className="text-sm text-mist">{entries.length}</p>
    </header>
    <ul className="space-y-2">
      {entries.map((entry, index) => {
        const { titleId, status } = statusOf(entry);
        return (
          <li key={`${entry.kind}:${entry.tmdbId}`} className="stagger-in" style={staggerStyle(index)}>
            <SearchResultRow
              result={entry}
              titleId={titleId}
              status={status}
              detail={role === "reparto" && entry.character ? entry.character : null}
              onPreview={onPreview}
            />
          </li>
        );
      })}
    </ul>
  </section>
);
