import Link from "next/link";
import { JuegosIcon } from "@/components/juegos/JuegosIcon";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import type { JuegoTile } from "@/lib/juegos/store";
import { focusRing } from "@/lib/ui";

/**
 * Extras in Hoy's second act (FIL-I50-2, entry B, board Juegos-2): up to two cards and «Ver todos».
 * Nothing when there is nothing to play; its data failing only hides it.
 */
export const JuegosBlock = ({ tiles }: { tiles: readonly JuegoTile[] }) => {
  if (tiles.length === 0) {
    return null;
  }
  return (
    <section className="act-two-block" aria-labelledby="act-two-juegos-title" data-act-two="juegos">
      <div className="flex items-end justify-between gap-3 px-4">
        <div className="act-two-head !px-0">
          <h2 id="act-two-juegos-title" className="font-serif">
            Extras
          </h2>
        </div>
        <Link
          href={`${JUEGOS_PATH}?desde=bloque`}
          data-juegos-entry="bloque"
          className={cn("relative -my-2 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:text-accent-hover", focusRing)}
        >
          Ver todos
        </Link>
      </div>
      <ul className="mt-2 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {tiles.map((tile) => (
          <li key={tile.id} className="w-[13.4rem] shrink-0">
            <Link
              href={tile.href}
              className={cn(
                "flex h-full flex-col gap-2 rounded-[1.4rem] border border-line bg-surface p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition-colors hover:border-line-hover",
                tile.eyebrow === "De temporada" && "border-star/50 bg-[#211d12]",
                focusRing,
              )}
            >
              <span className="flex gap-1.5" aria-hidden="true">
                {tile.posters.length > 0 ? (
                  tile.posters.map((posterPath) => (
                    <span key={posterPath} className="h-[66px] w-11 overflow-hidden rounded-md">
                      <PosterImage name="" posterPath={posterPath} sizes="44px" tmdbSize="w185" ratio="fill" />
                    </span>
                  ))
                ) : (
                  <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-chrome text-accent">
                    <JuegosIcon className="size-6" />
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{tile.eyebrow}</span>
              <span className="text-base font-semibold text-paper">{tile.name}</span>
              <span className="text-sm leading-snug text-fog">{tile.line}</span>
              <span className="mt-1 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(tile.progress * 100)}%` }} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
