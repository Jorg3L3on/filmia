"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PosterImage } from "@/components/PosterImage";
import type { StartArrival } from "@/lib/buscar-start";
import { cn } from "@/lib/cn";
import { groupByDecade, type DecadeTitle } from "@/lib/decades";
import { useAmbientPause, useAtmosphereOn } from "@/lib/motion-atmosphere";
import { focusRing } from "@/lib/ui";

/** The arrivals row's exact poster request (same size, same URL): the wall reuses those images. */
export const ARRIVAL_POSTER = { sizes: "100px", tmdbSize: "w185" } as const;

const WALL_MIN = 3;

/**
 * «Muro vivo» (FIL-I46-4): three slow columns of the posters this page already shows, dimmed far
 * behind the start screen. Never a new image (same URLs as the arrivals row), never under reduced
 * motion or lite sala, paused off screen. Gone as soon as there is text (the start screen leaves).
 */
/** The decade shelf's first posters: the rail shows them, with these exact request parameters. */
export const SHELF_POSTER = { sizes: "92px", tmdbSize: "w185" } as const;
const WALL_FROM_SHELF = 4;

type WallPoster = { key: string; posterPath: string | null; sizes: string; tmdbSize: "w185" };

/** The wall's posters: the arrivals row's and the first of the open decade shelf, each with its own request. */
export const wallPosters = (arrivals: StartArrival[], shelf: DecadeTitle[]): WallPoster[] => [
  ...arrivals.map((arrival) => ({ key: `a-${arrival.titleId}`, posterPath: arrival.posterPath, ...ARRIVAL_POSTER })),
  ...shelf
    .filter((title) => title.posterPath)
    .slice(0, WALL_FROM_SHELF)
    .map((title) => ({ key: `d-${title.id}`, posterPath: title.posterPath, ...SHELF_POSTER })),
];

export const PosterWall = ({ arrivals, shelf = [] }: { arrivals: StartArrival[]; shelf?: DecadeTitle[] }) => {
  const on = useAtmosphereOn();
  const ref = useRef<HTMLDivElement>(null);
  useAmbientPause(ref, on);
  const posters = wallPosters(arrivals, shelf);
  if (!on || posters.length < WALL_MIN) {
    return null;
  }
  const columns = [0, 1, 2].map((column) => posters.filter((_, index) => index % 3 === column).concat(posters));
  return (
    <div ref={ref} aria-hidden="true" data-poster-wall className="poster-wall">
      {columns.map((posters, column) => (
        <div key={column} className="poster-wall-col" style={{ "--col": column } as CSSProperties}>
          {/* Twice, so the column loops without a seam. */}
          {[...posters, ...posters].map((poster, index) => (
            <PosterImage
              key={`${poster.key}-${index}`}
              name=""
              posterPath={poster.posterPath}
              sizes={poster.sizes}
              tmdbSize={poster.tmdbSize}
              className="rounded-lg"
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/** «Explora por década»: your library by decade, with counts; the shelf scrolls only by hand. */
export const DecadeExplorer = ({ titles }: { titles: DecadeTitle[] }) => {
  const shelves = groupByDecade(titles);
  const [picked, setPicked] = useState<number | null>(null);
  if (shelves.length === 0) {
    return null;
  }
  const shelf = shelves.find((item) => item.decade === picked) ?? shelves[0]!;
  return (
    <section aria-labelledby="buscar-decadas" className="space-y-3" data-decades>
      <h2 id="buscar-decadas" className="text-[11px] font-medium uppercase tracking-[0.2em] text-mist">
        Explora por década
      </h2>
      <div role="radiogroup" aria-label="Década" className="rail -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {shelves.map((item) => {
          const active = item.decade === shelf.decade;
          return (
            <button
              key={item.decade}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPicked(item.decade)}
              className={cn(
                "press-scale flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm",
                active ? "border-accent/60 bg-accent/15 text-paper" : "border-line bg-surface/70 text-fog hover:text-paper",
                focusRing,
              )}
            >
              <span className="font-serif">{item.label}</span>
              <span className="text-xs tabular-nums text-mist">{item.titles.length}</span>
            </button>
          );
        })}
      </div>
      <ul key={shelf.decade} className="rail rail-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label={`Tus títulos de los ${shelf.label}`}>
        {shelf.titles.map((title, index) => (
          <li key={title.id} className="cascade-in cascade-item w-[5.75rem] shrink-0" style={{ "--cascade-i": index } as CSSProperties}>
            <Link href={`/titulos/${title.id}`} className={cn("press-scale flex flex-col gap-1.5 rounded-xl p-0.5", focusRing)}>
              <PosterImage name={title.name} posterPath={title.posterPath} sizes={SHELF_POSTER.sizes} tmdbSize={SHELF_POSTER.tmdbSize} className="rounded-lg" />
              <span className="line-clamp-2 text-xs leading-snug text-paper">{title.name}</span>
              <span className="-mt-1 text-[11px] text-mist">{title.year}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const SEEN_KEY = "filmia:arrivals-seen";

/**
 * The arrivals this device has not seen yet (FIL-I46-4): their «Ya en …» ribbon drops once.
 * Read after mount (storage is per device), then every shown arrival counts as seen.
 */
export const useNewArrivals = (ids: string[]) => {
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const key = ids.join(",");
  useEffect(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
    } catch {
      seen = [];
    }
    const known = new Set(Array.isArray(seen) ? seen : []);
    const current = key ? key.split(",") : [];
    // Device storage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFresh(new Set(current.filter((id) => !known.has(id))));
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...current, ...known])].slice(0, 200)));
    } catch {
      // Private mode: the ribbon may drop again next time, nothing else.
    }
  }, [key]);
  return fresh;
};
