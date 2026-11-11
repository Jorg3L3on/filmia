import Link from "next/link";
import type { CSSProperties } from "react";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { cn } from "@/lib/cn";
import { toDateInput } from "@/lib/dates";
import { ratingToStars } from "@/lib/labels";
import { focusRing } from "@/lib/ui";
import { stripOrder } from "@/lib/year-in-film";

type StripTitle = {
  id: string;
  name: string;
  posterPath: string | null;
  watchedAt: Date | string | null;
  rating: number | null;
};

const WEEKDAY = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "UTC" });

/** «jue 9» for a diary day (the UTC calendar day the diary stores). */
const frameDate = (day: string) => {
  const date = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAY.format(date).replace(".", "")} ${date.getUTCDate()}`;
};

/**
 * Diario «Tira» (FIL-I46-5): the month as a strip of film, a frame per entry with its date and
 * stars under it, in the calendar's order. The strip moves only by hand.
 */
export const DiaryStrip = ({ titles, month }: { titles: StripTitle[]; month: string }) => {
  const frames = stripOrder(titles);
  // A rewatch puts a film twice in a month: only its first frame carries the poster morph name.
  const morphed = new Set<string>();
  return (
    <div className="diary-strip -mx-4 sm:mx-0" data-diary-strip={month}>
      <ol className="rail flex gap-0 overflow-x-auto px-4 pb-2 sm:px-0" aria-label="Tu mes, en tira">
        {frames.map((title, index) => {
          const day = toDateInput(title.watchedAt);
          const stars = ratingToStars(title.rating);
          const share = !morphed.has(title.id);
          morphed.add(title.id);
          return (
            <li key={`${title.id}-${day}`} data-strip-frame={title.id} className="diary-strip-frame cascade-in cascade-item w-[7.25rem] shrink-0" style={{ "--cascade-i": index } as CSSProperties}>
              <Link href={`/titulos/${title.id}`} className={cn("press-scale block rounded-md p-1.5", focusRing)}>
                <SharedPoster titleId={title.id} share={share}>
                  <PosterImage name={title.name} posterPath={title.posterPath} sizes="112px" tmdbSize="w185" className="rounded-[4px]" />
                </SharedPoster>
              </Link>
              <p className="mt-1.5 px-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-paper">{frameDate(day)}</p>
              <p className="px-1.5 text-[11px] text-star" aria-label={stars == null ? "Sin calificación" : `${stars} estrellas`}>
                {stars == null ? <span className="text-mist">—</span> : `★ ${stars.toFixed(1)}`}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
