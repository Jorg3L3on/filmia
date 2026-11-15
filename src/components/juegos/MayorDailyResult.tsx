import Link from "next/link";
import type { ReactNode } from "react";
import { MayorTopBar } from "@/components/juegos/MayorGame";
import { ResultSquares } from "@/components/juegos/Piezas";
import { addDays, mxToday } from "@/lib/cine-core";
import { cn } from "@/lib/cn";
import { mxDayStart } from "@/lib/juegos/core";
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

const Avatar = ({ id, initial, me = false }: { id: string; initial: string; me?: boolean }) => (
  <span
    className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold", me ? "border-white/[0.14] bg-[#232a31] text-paper" : toneOf(id))}
    aria-hidden="true"
  >
    {initial}
  </span>
);

/** «viernes 13»: short enough for the header at 375 px. */
export const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/** «9 h 12 min» until the next daily (midnight in Mexico City). */
export const untilNextDaily = (now: Date) => {
  const minutes = Math.max(1, Math.ceil((mxDayStart(addDays(mxToday(now), 1)).getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} min` : `${hours} h ${minutes % 60} min`;
};

/**
 * The daily's result (FIL-I56-5, board M-6-resultado): a ticket that is shared as it is (game,
 * number, lens, score, squares, days in a row), then the day among the person's people with their
 * squares, how many are still to play (a count, never names) and the countdown to the next one.
 */
export const MayorDailyResult = ({ result, share, now = new Date() }: { result: DailyResult; share?: ReactNode; now?: Date }) => {
  const { view, table, streak, notYet } = result;
  const day = view.day ?? "";
  const lens = MAYOR_LENSES[view.lens];
  const finished = table.filter((row) => row.finished);
  const halfway = table.filter((row) => !row.finished && !row.me);
  const alone = finished.length === 1 && finished[0]!.me;
  const people = table.length + notYet;
  const missing = notYet;
  return (
    <div className="flex flex-1 flex-col" data-mayor="resultado">
      <MayorTopBar eyebrow={`La diaria n.º ${dailyNumber(day)} · ${dayLabel(day)}`} title="Así te fue" backHref={MAYOR_PATH} />

      <section
        className="relative mt-3.5 overflow-hidden rounded-[1.375rem] border border-white/[0.14] bg-[linear-gradient(160deg,#252c34,#171c22)] px-[18px] pb-4 pt-[18px] shadow-[0_24px_44px_-26px_#000]"
        aria-label="Tu resultado"
        data-mayor="boleto"
      >
        <span aria-hidden="true" className="absolute -left-3 top-[99px] size-[22px] rounded-full border border-white/[0.14] bg-canvas" />
        <span aria-hidden="true" className="absolute -right-3 top-[99px] size-[22px] rounded-full border border-white/[0.14] bg-canvas" />
        <div className="flex h-[78px] items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Filmia · Mayor o menor</span>
            <span className="text-sm text-fog">
              n.º {dailyNumber(day)} · {lens.short}
            </span>
            {streak >= 2 ? (
              <span className="mt-1.5 w-max rounded-full border border-line bg-chrome px-2.5 py-0.5 text-xs font-semibold text-paper">{streak} días seguidos</span>
            ) : null}
          </div>
          <span className="shrink-0 font-serif text-[56px] font-semibold leading-[0.9] tracking-[-0.02em] text-paper tabular-nums" data-mayor="puntos">
            {view.score}
            <span className="text-2xl tracking-normal text-fog"> de {view.total}</span>
          </span>
        </div>
        <div aria-hidden="true" className="mb-3.5 mt-[13px] border-t-2 border-dashed border-[#3a4452]" />
        <ResultSquares
          answers={view.answers}
          total={view.total}
          className="justify-between"
          label={`${view.score} aciertos y ${view.total - view.score} fallos`}
        />
        <p className="mt-3 text-xs text-fog">Los cuadritos no revelan qué películas eran.</p>
      </section>
      {share ? <div className="mt-3">{share}</div> : null}

      <section aria-labelledby="mayor-tabla" className="mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-2.5">
          <h2 id="mayor-tabla" className="text-[17px] font-semibold text-paper">
            Hoy entre tu gente
          </h2>
          {people > 1 ? (
            <span className="text-xs text-fog tabular-nums">
              {finished.length} de {people} ya jugaron
            </span>
          ) : null}
        </div>
        {alone ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] leading-snug text-fog" data-mayor="primera">
            Eres la primera persona de tu gente en jugar hoy.
          </p>
        ) : null}
        <ol className={cn("flex flex-col gap-1", alone && "mt-2")} data-mayor="tabla">
          {finished.map((row) => (
            <li
              key={row.partidaId}
              className={cn("flex min-h-[3.25rem] items-center gap-2.5 rounded-2xl px-3 py-1.5 text-[15px]", row.me && "border border-accent/45 bg-accent/[0.12]")}
            >
              <span className={cn("w-[22px] shrink-0 text-center font-serif text-[17px] font-semibold", row.place === 1 ? "text-star" : "text-fog")}>{row.place}</span>
              <Avatar id={row.userId} initial={row.me ? "T" : row.initial} me={row.me} />
              <span className={cn("min-w-0 flex-1 truncate text-paper", row.me && "font-semibold")}>{row.me ? "Tú" : row.name}</span>
              <span className="hidden min-[360px]:block" aria-hidden="true">
                <ResultSquares answers={row.answers.map((answer) => answer === true)} total={view.total} size="sm" className="flex-nowrap" />
              </span>
              <span className="w-6 text-right font-serif text-[19px] font-semibold tabular-nums text-paper">{row.score}</span>
            </li>
          ))}
          {halfway.map((row) => (
            <li key={row.partidaId} className="flex min-h-[3.25rem] items-center gap-2.5 px-3 py-1.5 text-[15px]">
              <span className="w-[22px] shrink-0 text-center text-fog">·</span>
              <Avatar id={row.userId} initial={row.initial} />
              <span className="min-w-0 flex-1 truncate text-fog">{row.name} va a medias</span>
            </li>
          ))}
        </ol>
        {missing > 0 ? (
          <p className="mt-2 px-3 text-xs text-fog">
            {missing === 1 ? "Falta una persona de tu gente." : `Faltan ${missing} de tu gente.`} Sus cuadritos aparecen cuando jueguen.
          </p>
        ) : null}
      </section>

      <div className="mt-4 flex items-center gap-3 rounded-[1.375rem] border border-line bg-surface px-3 py-2.5" data-mayor="siguiente">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-[15px] font-semibold text-paper">La siguiente, en {untilNextDaily(now)}</b>
          <span className="text-sm text-fog">Mientras, sigue en racha libre.</span>
        </span>
        <Link href={MAYOR_PATH} className={buttonClass({ variant: "secondary", size: "md", className: "shrink-0" })}>
          Racha libre
        </Link>
      </div>
    </div>
  );
};
