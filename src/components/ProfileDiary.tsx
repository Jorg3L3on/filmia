import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { cn } from "@/lib/cn";
import {
  WEEKDAY_LABELS_SHORT,
  groupTitlesByWatchedDay,
  toDateInput,
  todayDateInput,
} from "@/lib/dates";
import { DIARY_HISTORIAL_PATH } from "@/lib/diary-picks";
import { getRecentWatchedTitles, getWatchedSince } from "@/lib/queries";
import { focusRing } from "@/lib/ui";

const WEEK_DAYS = 7;
const RECENT_LIMIT = 3;
const WEEKDAY_FROM_GETDAY = [6, 0, 1, 2, 3, 4, 5] as const;

const localDaysBack = (days: number) => {
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index));
    return date;
  });
};

/** Buscar in «log as seen on this day» mode: what the strip's empty cells and «Registrar» open. */
const logTodayHref = (iso: string) => `/buscar?fecha=${iso}&destino=visto`;

/** Perfil «Tu diario»: this week at a glance, then the way into the full diary. */
export const ProfileDiary = async () => {
  const days = localDaysBack(WEEK_DAYS);
  const firstDay = days[0] ?? new Date();
  const since = new Date(Date.UTC(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()));
  const [week, recent] = await Promise.all([
    getWatchedSince(since),
    getRecentWatchedTitles(RECENT_LIMIT),
  ]);
  const byDay = groupTitlesByWatchedDay(week);
  const today = todayDateInput();
  const weekCount = week.length;

  return (
    <section aria-labelledby="perfil-diario" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="perfil-diario" className="font-serif text-[1.375rem] leading-tight text-paper">
            Tu diario
          </h2>
          <p className="mt-0.5 text-xs text-fog">
            {weekCount === 1 ? "1 esta semana" : `${weekCount} esta semana`}
          </p>
        </div>
        {/* Registrar (FIL-I25-1): the strip's «+» for today, the most frequent thing done here; 36 px, 44 to the touch. */}
        <Link
          href={logTodayHref(today)}
          aria-label="Registrar algo visto hoy"
          className={cn(
            "press-scale relative inline-flex h-9 items-center gap-1.5 rounded-full border border-chrome bg-well px-3 text-[13px] font-medium text-paper transition-colors duration-[var(--duration-hover)] hover:border-accent/50 hover:text-accent",
            "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
            focusRing,
          )}
        >
          <PlusIcon size={14} /> Registrar
        </Link>
      </div>

      <ul className="grid grid-cols-7 gap-1.5" aria-label="Esta semana">
        {days.map((date) => {
          const iso = todayDateInput(date);
          const titles = byDay.get(iso) ?? [];
          const primary = titles[0];
          const isToday = iso === today;
          const label = WEEKDAY_LABELS_SHORT[WEEKDAY_FROM_GETDAY[date.getDay()] ?? 0];
          const href = primary ? `/titulos/${primary.id}` : logTodayHref(iso);
          return (
            <li key={iso} className="min-w-0">
              <Link
                href={href}
                aria-label={`${label} ${date.getDate()}${titles.length > 0 ? `, ${titles.length} visionado${titles.length > 1 ? "s" : ""}` : isToday ? ", hoy, registrar" : ", sin visionados"}`}
                className={cn("flex flex-col items-center gap-1 text-center", focusRing)}
              >
                <span className={cn("text-[10px] uppercase tracking-[0.12em]", isToday ? "text-accent" : "text-mist")}>
                  {label}
                </span>
                <span className={cn("text-[13px]", isToday ? "font-semibold text-accent" : "text-paper/80")}>
                  {date.getDate()}
                </span>
                <span
                  className={cn(
                    "relative flex aspect-[2/3] w-full max-w-[52px] items-center justify-center overflow-hidden rounded-[10px]",
                    primary
                      ? "bg-well shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                      : isToday
                        ? "border-[1.5px] border-dashed border-accent/70 bg-accent/8 text-accent shadow-[0_0_0_4px_rgb(var(--accent-rgb)/0.12)]"
                        : "border border-line bg-well",
                  )}
                >
                  {primary ? (
                    // share={false}: the same title can sit on more than one day, and a morph name must be unique.
                    <SharedPoster titleId={primary.id} share={false} className="absolute inset-0">
                      <PosterImage
                        name={primary.name}
                        posterPath={primary.posterPath}
                        ratio="fill"
                        sizes="52px"
                        tmdbSize="w185"
                        className="h-full rounded-none"
                      />
                    </SharedPoster>
                  ) : isToday ? (
                    <PlusIcon />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-white/15" aria-hidden="true" />
                  )}
                  {titles.length > 1 ? (
                    <span className="absolute bottom-1 right-1 rounded-full bg-accent px-1 text-[9px] font-semibold text-ink">
                      +{titles.length - 1}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {recent.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface/40 px-4 py-5 text-center text-sm text-fog">
          Todavía no hay entradas. Arranca el talón de una carta en Hoy y aparecerá aquí.
        </p>
      ) : null}
      <Link
        href={DIARY_HISTORIAL_PATH}
        className={cn(
          "flex h-11 w-full items-center justify-center rounded-[var(--radius-button)] border border-chrome text-sm font-medium text-paper tab-transition hover:bg-chrome",
          focusRing,
        )}
      >
        Ver todo el diario
      </Link>
    </section>
  );
};

/** Keeps `toDateInput` in the import graph for the UTC-noon convention this strip relies on. */
void toDateInput;

const PlusIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
