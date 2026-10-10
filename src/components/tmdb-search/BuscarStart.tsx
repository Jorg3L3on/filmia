"use client";

import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import type { StartDirector } from "@/lib/buscar-start";
import { cn } from "@/lib/cn";
import { staggerStyle } from "@/lib/motion";
import { buildPersonSearchHref } from "@/lib/person-filmography";
import { tmdbProfileUrl } from "@/lib/tmdb";
import { focusRing } from "@/lib/ui";

type BuscarStartProps = {
  recents: string[];
  onPickRecent: (query: string) => void;
  onClearRecents: () => void;
  directors: StartDirector[];
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

/** Buscar before typing: recent searches on this device and the directors of your favorites. */
export const BuscarStart = ({ recents, onPickRecent, onClearRecents, directors }: BuscarStartProps) => {
  if (recents.length === 0 && directors.length === 0) {
    return (
      <EmptyState
        variant="buscar"
        title="Busca un título"
        description="Escribe un título o un director. Lo que añadas se guarda en Quiero ver, como vista o en tus listas."
      />
    );
  }

  return (
    <div className="space-y-8">
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

      {directors.length > 0 ? (
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
      ) : null}
    </div>
  );
};
