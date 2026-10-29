"use client";

import { useId } from "react";
import { Button } from "@/components/Button";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { TmdbPersonAvatar } from "@/components/TmdbPersonAvatar";
import { staggerStyle } from "@/lib/motion-style";
import type { BridgeReveal } from "@/lib/universo/store";

/** Posters drawn at most; the rest become a «+N» chip (the full list is in «Ver el universo»). */
const MAX_POSTERS = 3;

const TILT: Record<number, readonly number[]> = { 1: [0], 2: [-7, 7], 3: [-9, 0, 9] };

/**
 * U4 · «Vi esto» joined two films by different directors through someone already in your
 * universe: the moment the map grows a bridge. Once per person. Option B of FIL-IDEA5 (FIL-33):
 * the posters tilted around the person's portrait, a dotted thread, «Llevas n de sus N».
 */
export const BridgeSheet = ({ bridge, onClose }: { bridge: BridgeReveal | null; onClose: () => void }) => {
  const headingId = useId();
  return (
    <Sheet open={Boolean(bridge)} onClose={onClose} labelledBy={headingId} overlayLabel="Cerrar" align="bottom" dragDismiss portal>
      {bridge ? (
        <div className="flex flex-col gap-4 px-5 pb-5 pt-3 text-center">
          <SheetHandle />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-affinity">Nuevo puente</p>
          <BridgeArt bridge={bridge} />
          <div className="space-y-1.5">
            <h2 id={headingId} className="font-serif text-2xl leading-tight text-paper">
              {bridge.personName}, {bridge.roleLabel}
            </h2>
            <p className="text-[14px] leading-snug text-paper/85">{bridge.line}</p>
          </div>
          {bridge.progress ? <BridgeProgress {...bridge.progress} /> : null}
          <div className="flex flex-col gap-2">
            <Button href="/perfil/universo" variant="primary" size="lg" onClick={onClose}>
              Ver el universo
            </Button>
            <Button variant="ghost" size="md" onClick={onClose}>
              Listo
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
};

/** Posters fanned around the portrait, a dotted thread through them, titles with their year below. */
const BridgeArt = ({ bridge }: { bridge: BridgeReveal }) => {
  const shown = bridge.films.slice(0, MAX_POSTERS);
  const more = bridge.films.length - shown.length;
  const tilts = TILT[shown.length] ?? TILT[MAX_POSTERS]!;
  const overlap = shown.length > 2 ? "-mx-3" : "mx-2";
  return (
    <div className="flex flex-col items-center gap-3">
      <div aria-hidden="true" className="relative flex items-center justify-center pt-1">
        <span className="absolute inset-x-10 top-1/2 border-t-2 border-dotted border-affinity/70" />
        {shown.map((film, index) => (
          <div key={`${film.tmdbId}-${index}`} className={`relative ${overlap}`} style={{ transform: `rotate(${tilts[index]}deg)`, zIndex: index === 1 && shown.length === 3 ? 0 : 1 }}>
            <div className="stagger-in w-[98px] overflow-hidden rounded-[10px] shadow-[0_18px_36px_-16px_rgb(0_0_0/0.9)] ring-1 ring-white/12" style={staggerStyle(index, 180)}>
              <PosterImage name={film.name} posterPath={film.posterPath} sizes="98px" tmdbSize="w185" />
            </div>
          </div>
        ))}
        <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <TmdbPersonAvatar personId={bridge.person.id} name={bridge.personName} profilePath={bridge.person.profilePath} size={80} ring />
        </span>
        {more > 0 ? (
          <span className="absolute -right-1 bottom-1 z-10 rounded-full bg-chrome px-2 py-0.5 text-[12px] font-semibold tabular-nums text-paper ring-1 ring-affinity/60">
            +{more}
          </span>
        ) : null}
      </div>
      <ul aria-label="Películas del puente" className="flex max-w-full flex-wrap justify-center gap-x-3 gap-y-1 text-[12px] leading-snug text-fog">
        {shown.map((film, index) => (
          <li key={`${film.tmdbId}-${index}`} className="max-w-[9.5rem]">
            <span className="text-paper/90">{film.name}</span>
            {film.year ? <span className="tabular-nums"> · {film.year}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

const BridgeProgress = ({ seen, total }: { seen: number; total: number }) => (
  <div className="mx-auto w-full max-w-[16rem] space-y-1.5">
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-affinity" style={{ width: `${Math.max(4, Math.round((seen / total) * 100))}%` }} />
    </div>
    <p className="text-[12px] tabular-nums text-fog">
      Llevas {seen} de sus {total}
    </p>
  </div>
);
