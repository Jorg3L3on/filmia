import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { PosterTile } from "@/components/PosterTile";
import {
  buildDiaryMonths,
  titlesWithoutWatchDate,
  type DiaryTitle,
} from "@/lib/diary";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;

type DiaryCalendarProps = {
  titles: DiaryTitle[];
};

export const DiaryCalendar = ({ titles }: DiaryCalendarProps) => {
  const months = buildDiaryMonths(titles);
  const undated = titlesWithoutWatchDate(titles);

  if (months.length === 0 && undated.length === 0) {
    return null;
  }

  return (
    <div className="space-y-10">
      {months.map((month) => {
        const leading = Array.from({ length: month.startWeekday }, (_, index) => index);
        const days = Array.from({ length: month.daysInMonth }, (_, index) => index + 1);

        return (
          <section key={month.key} className="space-y-3">
            <h2 className="font-serif text-xl capitalize text-white sm:text-2xl">
              {month.label}
            </h2>
            <div className="overflow-hidden rounded-md border border-line bg-canvas-deep">
              <div className="grid grid-cols-7 border-b border-line bg-well">
                {WEEKDAYS.map((day) => (
                  <p
                    key={day}
                    className="px-1 py-2 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-mist"
                  >
                    {day}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {leading.map((slot) => (
                  <div
                    key={`lead-${month.key}-${slot}`}
                    className="aspect-square border-b border-r border-line/80 bg-canvas-deep"
                  />
                ))}
                {days.map((day) => {
                  const entries = month.days.get(day) ?? [];
                  const primary = entries[0];

                  if (!primary) {
                    return (
                      <div
                        key={`${month.key}-${day}`}
                        className="relative aspect-square border-b border-r border-line/80 bg-well"
                      >
                        <span className="absolute left-1 top-1 text-[10px] text-faint">
                          {day}
                        </span>
                      </div>
                    );
                  }

                  const extra = entries.length - 1;
                  const label = entries
                    .map((entry) => entry.name)
                    .join(", ");

                  return (
                    <Link
                      key={`${month.key}-${day}`}
                      href={`/titulos/${primary.id}`}
                      aria-label={`${day} de ${month.label}: ${label}`}
                      className={cn(
                        "group relative aspect-square overflow-hidden border-b border-r border-line/80 bg-well",
                        focusRing,
                      )}
                    >
                      <PosterImage
                        name={primary.name}
                        posterPath={primary.posterPath}
                        sizes="120px"
                        ratio="fill"
                        className="h-full rounded-none transition duration-200 group-hover:brightness-110"
                      />
                      <span className="absolute left-1 top-1 rounded-[2px] bg-canvas/80 px-1 text-[10px] font-medium text-white">
                        {day}
                      </span>
                      {extra > 0 ? (
                        <span className="absolute bottom-1 right-1 rounded-[2px] bg-accent px-1 text-[10px] font-semibold text-ink">
                          +{extra}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      {undated.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-serif text-xl text-white">Sin fecha</h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {undated.map((title) => (
              <li key={title.id}>
                <PosterTile
                  href={`/titulos/${title.id}`}
                  name={title.name}
                  posterPath={title.posterPath}
                  year={title.year}
                  rating={title.rating}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
