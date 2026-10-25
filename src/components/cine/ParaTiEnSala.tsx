import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { RemindPremiereButton } from "@/components/cine/RemindPremiereButton";
import { StartRutaButton } from "@/components/universo/StartRutaButton";
import { formatShortDay } from "@/lib/cine-core";
import { daysLabel } from "@/lib/cine-cuenta";
import { loadCountdowns } from "@/lib/cine-cuenta-store";
import { previewFichaHref } from "@/lib/title-preview";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/**
 * P3 · «Para ti, en sala» (FIL-I26-5): the nearest premiere with someone of your universe behind
 * it, the days left, why it is yours, «Avísame el día» and its ruta to see first. Absent when
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
            {hero.season.started ? (
              <Link href="/rutas" className={cn("text-[13px] text-accent-hover underline", focusRing)}>
                Ya tienes su ruta antes de verla
              </Link>
            ) : (
              <StartRutaButton sourceKey={hero.season.sourceKey} label="Ruta: antes de verla" variant="secondary" size="md" />
            )}
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
                  className={cn("flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5", focusRing)}
                >
                  <span className="w-14 shrink-0 text-center font-serif text-xl text-cine">{Math.max(0, item.days)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-paper">{item.release.name}</span>
                    <span className="block truncate text-[12px] text-fog">{item.reason}</span>
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
