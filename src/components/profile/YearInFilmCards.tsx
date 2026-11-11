"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { CountUp } from "@/components/atmosphere/CountUp";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { ratingToStars } from "@/lib/labels";
import { monthShareText } from "@/lib/share-card";
import { showToast } from "@/lib/toast";
import { focusRing, glassRowClass } from "@/lib/ui";
import { YEAR_MIN_ENTRIES, type MonthInFilm, type YearInFilm } from "@/lib/year-in-film";

const MONTHS_SHORT = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const Stat = ({ value, label }: { value: number; label: string }) => (
  <div className="min-w-0">
    <CountUp value={value} className="block font-serif text-3xl leading-none text-paper" />
    <span className="mt-1 block text-[11px] text-mist">{label}</span>
  </div>
);

/** «Tu año en cine»: counts, a bar per month and the genres, each animating once on arrival. */
export const YearInFilmCard = ({ stats }: { stats: YearInFilm }) => {
  if (stats.entries < YEAR_MIN_ENTRIES) {
    return (
      <section aria-labelledby="perfil-ano" data-year-invite className={cn(glassRowClass, "space-y-2 px-4 py-5")}>
        <h2 id="perfil-ano" className="font-serif text-[1.375rem] leading-tight text-paper">
          Tu año en cine
        </h2>
        <p className="text-sm text-fog">
          Registra {YEAR_MIN_ENTRIES} títulos en {stats.year} y aquí verás tus horas, tu racha y tus géneros.
        </p>
        <Link href="/buscar?destino=visto" className={cn("inline-flex h-10 items-center text-sm font-medium text-accent", focusRing)}>
          Registrar algo visto ›
        </Link>
      </section>
    );
  }
  const peak = Math.max(1, ...stats.byMonth);
  const topGenre = stats.genres[0]?.count ?? 1;
  return (
    <section aria-labelledby="perfil-ano" data-year-card className={cn(glassRowClass, "space-y-5 px-4 py-5")}>
      <div className="flex items-baseline justify-between">
        <h2 id="perfil-ano" className="font-serif text-[1.375rem] leading-tight text-paper">
          Tu año en cine
        </h2>
        <span className="text-xs tabular-nums text-mist">{stats.year}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat value={stats.films} label={stats.films === 1 ? "película" : "películas"} />
        <Stat value={stats.hours} label="horas" />
        <Stat value={stats.longestWeekStreak} label={stats.longestWeekStreak === 1 ? "semana seguida" : "semanas seguidas"} />
      </div>
      <ol className="flex h-20 items-end gap-1.5" aria-label="Por mes">
        {stats.byMonth.map((count, index) => (
          <li key={index} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span
              className="year-bar block w-full rounded-t-[3px]"
              aria-label={`${MONTHS_LONG[index]}: ${count}`}
              style={{ height: `${Math.max(4, (count / peak) * 100)}%`, "--bar-i": index, opacity: count ? 1 : 0.25 } as CSSProperties}
            />
            <span aria-hidden="true" className="text-[10px] text-mist">
              {MONTHS_SHORT[index]}
            </span>
          </li>
        ))}
      </ol>
      {stats.genres.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Géneros">
          {stats.genres.map((genre, index) => (
            <li key={genre.name} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-fog">{genre.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                <span className="genre-bar block h-full rounded-full" style={{ width: `${(genre.count / topGenre) * 100}%`, "--bar-i": index } as CSSProperties} />
              </span>
              <span className="w-6 shrink-0 text-right tabular-nums text-mist">{genre.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

/** «Tu mes en cine»: last month in three story panels (user-scrolled), with «Compartir». */
export const MonthInFilmCard = ({ month }: { month: MonthInFilm }) => {
  const monthLabel = MONTHS_LONG[Number(month.month.slice(5, 7)) - 1] ?? month.month;
  const text = monthShareText({ monthLabel, count: month.entries.length, hours: month.hours, topGenre: month.topGenre, best: month.best });
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Mi ${monthLabel} en cine`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast({ title: "Copiado", description: "Tu mes en cine, listo para pegar." });
    } catch {
      // Cancelled share sheet: nothing to say.
    }
  };
  const stars = ratingToStars(month.best?.rating);
  return (
    // inline-size containment: the story rail must not widen Perfil's fit-content column (FIL-I46-5).
    <section aria-labelledby="perfil-mes" data-month-card className="space-y-3 [contain:inline-size]">
      <div className="flex items-end justify-between gap-3">
        <h2 id="perfil-mes" className="font-serif text-[1.375rem] leading-tight text-paper">
          Tu {monthLabel} en cine
        </h2>
        <button type="button" onClick={share} data-share-month className={cn("press-scale inline-flex h-9 items-center rounded-full border border-chrome bg-well px-3 text-[13px] font-medium text-paper hover:border-accent/50", focusRing)}>
          Compartir
        </button>
      </div>
      <ol className="rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1" aria-label={`Tu ${monthLabel}, en tres pantallas`}>
        <li className="month-story snap-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{monthLabel}</span>
          <CountUp value={month.entries.length} className="font-serif text-6xl leading-none text-paper" />
          <span className="text-sm text-fog">
            {month.entries.length === 1 ? "título" : "títulos"}
            {month.hours > 0 ? ` · ${month.hours} h` : ""}
          </span>
        </li>
        <li className="month-story snap-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Lo tuyo</span>
          <span className="font-serif text-3xl leading-tight text-paper">{month.topGenre ?? "De todo un poco"}</span>
          {month.best ? (
            <span className="text-sm text-fog">
              La mejor: {month.best.name}
              {stars == null ? "" : ` · ★ ${stars.toFixed(1)}`}
            </span>
          ) : null}
        </li>
        <li className="month-story snap-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">La tira</span>
          <span className="grid grid-cols-4 gap-1.5">
            {month.entries.slice(0, 8).map((entry) => (
              <PosterImage key={entry.id} name={entry.name} posterPath={entry.posterPath} sizes="56px" tmdbSize="w185" className="rounded-md" />
            ))}
          </span>
        </li>
      </ol>
    </section>
  );
};
