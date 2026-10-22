"use client";

import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PlatformLogo } from "@/components/PlatformLogo";
import { PosterImage } from "@/components/PosterImage";
import type { StartArrival, StartDirector } from "@/lib/buscar-start";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { staggerStyle } from "@/lib/motion";
import { buildPersonSearchHref } from "@/lib/person-filmography";
import { tmdbProfileUrl } from "@/lib/tmdb";
import { diaryDayLabel } from "@/lib/title-preview";
import { focusRing } from "@/lib/ui";

type BuscarStartProps = {
  recents: string[];
  /** Start rows (FIL-I21-8): always shown when they have data, with or without recents. */
  directors?: StartDirector[];
  arrivals?: StartArrival[];
  onPickRecent: (query: string) => void;
  onClearRecents: () => void;
  /** Diario mode (FIL-I22-3): the day being logged (null = today); undefined outside Diario. */
  logDate?: string | null;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Round photo, or the initials on glass when TMDB has none. */
const DirectorFace = ({ director }: { director: StartDirector }) => {
  const src = tmdbProfileUrl(director.profilePath);
  return (
    <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-chrome ring-1 ring-white/15 shadow-[0_12px_26px_-14px_rgb(0_0_0/0.9)] transition-[box-shadow] duration-[var(--duration-hover)] ease-[var(--ease-out)] group-hover:ring-accent/60">
      {src ? (
        <Image src={src} alt="" fill sizes="64px" className="object-cover" unoptimized />
      ) : (
        <span className="font-serif text-xl text-paper/80">{initialsOf(director.name)}</span>
      )}
    </span>
  );
};

/**
 * Buscar (Todos) before typing: recent searches on this device, then «Directores de tus
 * favoritas» and «Llegó a tu plataforma» as start rows (FIL-I21-8). The empty card only when
 * none of the three has anything to show.
 */
export const BuscarStart = ({ recents, directors = [], arrivals = [], onPickRecent, onClearRecents, logDate }: BuscarStartProps) => {
  const logging = logDate !== undefined;
  if (recents.length === 0 && directors.length === 0 && arrivals.length === 0) {
    return logging ? (
      <EmptyState
        variant="buscar"
        title={`Busca lo que viste el ${diaryDayLabel(logDate)}`}
        description="Escribe el título y toca el check de la fila: la vista se registra ese día en tu Diario."
      />
    ) : (
      <EmptyState
        variant="buscar"
        title="Busca un título"
        description="Escribe un título o un director. Lo que añadas se guarda en Quiero ver, como vista o en tus listas."
      />
    );
  }

  return (
    <div className="space-y-8">
      {logging ? (
        <p className="font-serif text-xl text-paper">Busca lo que viste el {diaryDayLabel(logDate)}</p>
      ) : null}
      {recents.length > 0 ? (
        <section aria-labelledby="buscar-recientes" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="buscar-recientes" className="text-[11px] font-medium uppercase tracking-[0.2em] text-mist">
              Recientes
            </h2>
            <button
              type="button"
              onClick={onClearRecents}
              className={cn("rounded-md text-xs text-fog hover:text-paper", focusRing)}
            >
              Borrar
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recents.map((query, index) => (
              <li key={query} className="stagger-in min-w-0" style={staggerStyle(index)}>
                <button
                  type="button"
                  onClick={() => onPickRecent(query)}
                  className={cn(
                    "press-scale flex h-9 max-w-full items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 text-sm text-paper",
                    "transition-[border-color,background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-accent/40",
                    focusRing,
                  )}
                >
                  <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-mist" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4l3 2" />
                  </svg>
                  <span className="truncate">{query}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {directors.length > 0 ? <FavoriteDirectors directors={directors} /> : null}
      {arrivals.length > 0 ? <PlatformArrivalsRow arrivals={arrivals} /> : null}
    </div>
  );
};

/** «Llegó a tu plataforma»: Quiero ver titles that just reached one of your platforms, one tap to the ficha. */
export const PlatformArrivalsRow = ({ arrivals }: { arrivals: StartArrival[] }) => (
  <section aria-labelledby="buscar-llegadas" className="space-y-3">
    <h2 id="buscar-llegadas" className="text-[11px] font-medium uppercase tracking-[0.2em] text-mist">
      Llegó a tu plataforma
    </h2>
    <ul className="rail rail-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {arrivals.map((arrival, index) => (
        <li key={arrival.titleId} className="person-card-in w-[6.25rem] shrink-0" style={staggerStyle(index)}>
          <Link
            href={`/titulos/${arrival.titleId}`}
            className={cn("group press-scale flex flex-col gap-2 rounded-2xl p-1 text-left", focusRing)}
          >
            <span className="relative block overflow-hidden rounded-xl ring-1 ring-white/10">
              <PosterImage name={arrival.name} posterPath={arrival.posterPath} sizes="100px" tmdbSize="w185" className="rounded-xl" />
              <span className="absolute right-1.5 top-1.5">
                <PlatformLogo platform={arrival.platform} size={20} className="rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.4)] ring-1 ring-white/25" />
              </span>
            </span>
            <span className="line-clamp-2 text-xs leading-snug text-paper">{arrival.name}</span>
            <span className="-mt-1.5 truncate text-[11px] text-mist">{PLATFORM_SERVICE_LABEL[arrival.platform]}</span>
          </Link>
        </li>
      ))}
    </ul>
  </section>
);

/** The Director tab before typing: the directors of your favorites, one tap to their filmography. */
export const FavoriteDirectors = ({ directors }: { directors: StartDirector[] }) => (
  <section aria-labelledby="buscar-directores" className="space-y-3">
    <h2 id="buscar-directores" className="text-[11px] font-medium uppercase tracking-[0.2em] text-mist">
      Directores de tus favoritas
    </h2>
    <ul className="rail rail-fade -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {directors.map((director, index) => (
        <li key={director.id} className="person-card-in w-[5.5rem] shrink-0" style={staggerStyle(index)}>
          <Link
            href={buildPersonSearchHref({ personId: director.id, role: "director", name: director.name })}
            className={cn("group press-scale flex flex-col items-center gap-2 rounded-2xl px-1 py-1.5 text-center", focusRing)}
          >
            <DirectorFace director={director} />
            <span className="line-clamp-2 text-xs leading-snug text-paper">{director.name}</span>
            <span className="-mt-1.5 text-[11px] text-mist">
              {director.count === 1 ? "1 favorita" : `${director.count} favoritas`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </section>
);
