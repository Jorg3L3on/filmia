import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { RemindPremiereButton } from "@/components/cine/RemindPremiereButton";
import { formatShortDay } from "@/lib/cine-core";
import { daysLabel } from "@/lib/cine-cuenta";
import { loadCountdowns } from "@/lib/cine-cuenta-store";
import { previewFichaHref } from "@/lib/title-preview";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/**
 * P3 · «Para ti, en sala» (FIL-I26-5): the nearest premiere with someone of your universe behind
 * it, the days left, why it is yours, and «Avísame el día». Absent when
 * nobody of yours has a premiere coming: never a countdown without a person.
 */
export const ParaTiEnSala = async ({ userId }: { userId: string }) => {
  const countdowns = await loadCountdowns(userId).catch(() => []);
  const [hero, ...rest] = countdowns;
  if (!hero) {
    return null;
  }
  return (
    <section id="para-ti-en-sala" aria-labelledby="para-ti-en-sala-h" className="space-y-3">
      <h2 id="para-ti-en-sala-h" className="font-serif text-[1.375rem] leading-tight text-paper">
        Para ti, en sala
      </h2>
      <div className="flex gap-4 rounded-3xl border border-cine/50 bg-surface p-3">
        <Link
          href={previewFichaHref("MOVIE", hero.release.tmdbId)}
          className={cn("w-28 shrink-0 overflow-hidden rounded-2xl", focusRing)}
          aria-label={hero.release.name}
        >
          <PosterImage name={hero.release.name} posterPath={hero.release.posterPath} sizes="112px" tmdbSize="w342" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cine">
            {daysLabel(hero.days)}
            <span className="text-fog"> · {formatShortDay(hero.release.mxReleaseDate)}</span>
          </p>
          <p className="font-serif text-xl leading-tight text-paper">{hero.release.name}</p>
          <p className="text-[13px] leading-snug text-paper/85">{hero.reason}.</p>
          <div className="mt-1 flex flex-col gap-2">
            <RemindPremiereButton catalogId={hero.release.catalogId} reminded={hero.reminded} day={hero.release.mxReleaseDate} />
          </div>
        </div>
      </div>
      {rest.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">Otras que te importan</h3>
          <ul className="space-y-1.5">
            {rest.map((item) => (
              <li key={item.release.catalogId}>
                <Link
                  href={previewFichaHref("MOVIE", item.release.tmdbId)}
                  className={cn("flex items-center gap-3 rounded-2xl border border-line py-2 pl-2 pr-3", focusRing)}
                >
                  <span className="w-11 shrink-0 overflow-hidden rounded-lg">
                    <PosterImage name={item.release.name} posterPath={item.release.posterPath} sizes="44px" tmdbSize="w185" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-paper">{item.release.name}</span>
                    <span className="block truncate text-[12px] text-fog">{item.reason}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-serif text-xl leading-none text-cine">{Math.max(0, item.days)}</span>
                    <span className="block text-[10px] text-mist">{Math.max(0, item.days) === 1 ? "día" : "días"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
