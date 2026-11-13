import Link from "next/link";
import type { ReactNode } from "react";
import { LensChip, MayorTopBar, Squares } from "@/components/juegos/MayorGame";
import { cn } from "@/lib/cn";
import { dailyNumber, MAYOR_LENSES, MAYOR_PATH } from "@/lib/juegos/mayor/core";
import type { DailyResult } from "@/lib/juegos/mayor/store";
import { buttonClass } from "@/lib/ui";

const AVATAR_TONES = [
  "border-accent/45 bg-[#3a2318] text-accent",
  "border-[#8fb4ff]/45 bg-[#16203a] text-[#8fb4ff]",
  "border-success/45 bg-success-well text-success",
  "border-star/45 bg-[#2a2311] text-star",
  "border-[#ff9ccf]/45 bg-[#2c1626] text-[#ff9ccf]",
];

/** A stable tone per person, from their id. */
const toneOf = (id: string) => AVATAR_TONES[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length]!;

const Avatar = ({ id, initial }: { id: string; initial: string }) => (
  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border text-[15px] font-bold", toneOf(id))} aria-hidden="true">
    {initial}
  </span>
);

/** «viernes 13»: short enough for the header at 375 px. */
export const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/**
 * The daily's result (board M-3-diaria): score, squares, the day table among every account and a
 * small streak of days. Nobody is pressed: those who have not played are a count, not names.
 */
export const MayorDailyResult = ({ result, share }: { result: DailyResult; share?: ReactNode }) => {
  const { view, table, streak, notYet } = result;
  const day = view.day ?? "";
  const lens = MAYOR_LENSES[view.lens];
  const finished = table.filter((row) => row.finished);
  const halfway = table.filter((row) => !row.finished && !row.me);
  const alone = finished.length === 1 && finished[0]!.me;
  return (
    <div className="flex flex-1 flex-col gap-5" data-mayor="resultado">
      <MayorTopBar
        eyebrow={`La diaria · ${dayLabel(day)}`}
        title={`${view.score} de ${view.total}`}
        backHref={MAYOR_PATH}
        chip={streak >= 2 ? <LensChip>Racha: {streak} días</LensChip> : <LensChip>{lens.short}</LensChip>}
      />

      <section className="rounded-[1.4rem] border border-white/10 bg-[#171c21] p-4" aria-label="Tu resultado">
        <div className="flex items-center justify-between gap-3">
          <b className="text-[15px] text-paper">Filmia · Mayor o menor n.º {dailyNumber(day)}</b>
          <span className="text-sm text-fog">{lens.short}</span>
        </div>
        <div className="mt-3">
          <Squares answers={view.answers} total={view.total} />
        </div>
        <p className="mt-2.5 text-sm text-fog">Los cuadritos no revelan qué películas eran.</p>
        {share}
      </section>

      <section aria-labelledby="mayor-tabla">
        <h2 id="mayor-tabla" className="text-lg font-semibold text-paper">
          Hoy entre todos
        </h2>
        {alone ? (
          <p className="mt-2 rounded-2xl border border-line bg-surface px-4 py-4 text-[15px] leading-snug text-fog" data-mayor="primera">
            Eres la primera persona en jugar hoy.
          </p>
        ) : null}
        <ol className="mt-2 rounded-2xl border border-line bg-surface px-4 py-1.5" data-mayor="tabla">
          {finished.map((row) => (
            <li
              key={row.partidaId}
              className={cn(
                "flex min-h-[3.25rem] items-center gap-2.5 border-t border-line py-1.5 text-[15px] first:border-t-0",
                row.me && "-mx-2.5 rounded-xl border-transparent bg-accent/10 px-2.5",
              )}
            >
              <span className={cn("w-5 shrink-0 text-center font-serif font-semibold", row.place === 1 ? "text-star" : "text-fog")}>{row.place}</span>
              <Avatar id={row.userId} initial={row.initial} />
              <span className="min-w-0 flex-1 truncate font-semibold text-paper">{row.me ? "Tú" : row.name}</span>
              <span className="hidden min-[380px]:block">
                <Squares answers={row.answers.map((answer) => answer === true)} total={view.total} small />
              </span>
              <span className="w-6 text-right font-serif text-[1.2rem] font-semibold tabular-nums text-paper">{row.score}</span>
            </li>
          ))}
          {halfway.map((row) => (
            <li key={row.partidaId} className="flex min-h-[3.25rem] items-center gap-2.5 border-t border-line py-1.5 text-[15px]">
              <span className="w-5 shrink-0 text-center text-fog">·</span>
              <Avatar id={row.userId} initial={row.initial} />
              <span className="min-w-0 flex-1 truncate text-fog">{row.name} va a medias</span>
            </li>
          ))}
        </ol>
        {notYet > 0 ? (
          <p className="mt-2 text-sm text-fog">
            {notYet === 1 ? "Falta una cuenta por jugar hoy." : `Faltan ${notYet} cuentas por jugar hoy.`}
          </p>
        ) : null}
      </section>

      <div className="flex-1" />
      <Link href={MAYOR_PATH} className={buttonClass({ variant: "secondary", size: "lg", className: "w-full" })}>
        Seguir en racha libre
      </Link>
    </div>
  );
};
