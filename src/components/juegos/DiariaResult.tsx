import Link from "next/link";
import type { ReactNode } from "react";
import { LensChip, MayorTopBar } from "@/components/juegos/MayorGame";
import { dayLabel } from "@/components/juegos/MayorDailyResult";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { diariaNumber, DIARIAS, type DiariaId } from "@/lib/juegos/diarias/core";
import type { DiariaTable } from "@/lib/juegos/diarias/store";
import type { DayTableRow } from "@/lib/juegos/partidas";
import { buttonClass } from "@/lib/ui";

const AVATAR_TONES = [
  "border-accent/45 bg-[#3a2318] text-accent",
  "border-[#8fb4ff]/45 bg-[#16203a] text-[#8fb4ff]",
  "border-success/45 bg-success-well text-success",
  "border-star/45 bg-[#2a2311] text-star",
  "border-[#ff9ccf]/45 bg-[#2c1626] text-[#ff9ccf]",
];

const toneOf = (id: string) => AVATAR_TONES[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length]!;

export const DiariaAvatar = ({ id, initial }: { id: string; initial: string }) => (
  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border text-[15px] font-bold", toneOf(id))} aria-hidden="true">
    {initial}
  </span>
);

/** The header of a daily's play screen and result: back to Extras, eyebrow, name. */
export const DiariaTopBar = ({ eyebrow, title, chip }: { eyebrow: string; title: string; chip?: ReactNode }) => (
  <MayorTopBar eyebrow={eyebrow} title={title} chip={chip} backHref={JUEGOS_PATH} />
);

/**
 * A daily's result (FIL-I54; the same shape as M-3-diaria): the score, the person's marks, the
 * day table among every account and a small streak. Those who have not played are a count.
 */
export const DiariaResult = ({
  id,
  day,
  score,
  summary,
  table,
  rowScore,
  rowExtra,
  share,
  children,
}: {
  id: DiariaId;
  day: string;
  /** «13 de 18». */
  score: string;
  /** The person's own marks or answers, under the score. */
  summary: ReactNode;
  table: DiariaTable;
  /** What a finished row shows on the right («13»). */
  rowScore?: (row: DayTableRow) => ReactNode;
  /** A small line under a finished row's name (e.g. La cuadrícula's rarity). */
  rowExtra?: (row: DayTableRow) => ReactNode;
  share?: ReactNode;
  /** Anything after the summary (La cuadrícula's grid, Detalle's posters). */
  children?: ReactNode;
}) => {
  const finished = table.table.filter((row) => row.finished);
  const halfway = table.table.filter((row) => !row.finished && !row.me);
  const alone = finished.length === 1 && finished[0]!.me;
  return (
    <div className="flex flex-1 flex-col gap-5" data-diaria="resultado">
      <DiariaTopBar
        eyebrow={`${DIARIAS[id].name} · n.º ${diariaNumber(id, day)} · ${dayLabel(day)}`}
        title={score}
        chip={table.streak >= 2 ? <LensChip>Racha: {table.streak} días</LensChip> : undefined}
      />

      <section className="rounded-[1.4rem] border border-white/10 bg-[#171c21] p-4" aria-label="Tu resultado">
        {summary}
        {share}
      </section>

      {children}

      <section aria-labelledby="diaria-tabla">
        <h2 id="diaria-tabla" className="text-lg font-semibold text-paper">
          La tabla de hoy
        </h2>
        {alone ? <p className="mt-1 text-sm text-fog">Eres la primera persona en jugarla hoy. La tabla se llena conforme jueguen los demás.</p> : null}
        <ol className="mt-2" data-diaria="tabla">
          {finished.map((row) => (
            <li
              key={row.partidaId}
              className={cn(
                "flex min-h-[3.25rem] items-center gap-2.5 border-t border-line py-1.5 text-[15px] first:border-t-0",
                row.me && "-mx-2.5 rounded-xl border-transparent bg-accent/10 px-2.5",
              )}
            >
              <span className={cn("w-5 shrink-0 text-center font-serif font-semibold", row.place === 1 ? "text-star" : "text-fog")}>{row.place}</span>
              <DiariaAvatar id={row.userId} initial={row.initial} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-paper">{row.me ? "Tú" : row.name}</span>
                {rowExtra ? <span className="truncate text-xs text-fog">{rowExtra(row)}</span> : null}
              </span>
              <span className="text-right font-serif text-[1.2rem] font-semibold tabular-nums text-paper">{rowScore ? rowScore(row) : row.score}</span>
            </li>
          ))}
          {halfway.map((row) => (
            <li key={row.partidaId} className="flex min-h-[3.25rem] items-center gap-2.5 border-t border-line py-1.5 text-[15px]">
              <span className="w-5 shrink-0 text-center text-fog">·</span>
              <DiariaAvatar id={row.userId} initial={row.initial} />
              <span className="min-w-0 flex-1 truncate text-fog">{row.name} va a medias</span>
            </li>
          ))}
        </ol>
        {table.notYet > 0 ? (
          <p className="mt-2 text-sm text-fog">{table.notYet === 1 ? "Falta una cuenta por jugar hoy." : `Faltan ${table.notYet} cuentas por jugar hoy.`}</p>
        ) : null}
      </section>

      <div className="flex-1" />
      <Link href={JUEGOS_PATH} className={buttonClass({ variant: "secondary", size: "lg", className: "w-full" })}>
        Volver a Extras
      </Link>
    </div>
  );
};

/** The screen when today's round could not be made or opened. */
export const DiariaUnavailable = ({ id, failed }: { id: DiariaId; failed: boolean }) => (
  <div className="flex flex-col gap-6" data-diaria="sin-diaria">
    <DiariaTopBar eyebrow="La diaria" title={DIARIAS[id].name} />
    <p className="rounded-2xl border border-line bg-surface px-4 py-5 text-[15px] leading-snug text-fog">
      {failed
        ? "No pudimos abrir la diaria ahora. Vuelve a intentarlo en un momento."
        : "Hoy no hay suficientes películas conocidas para armar esta diaria. Mañana lo intentamos otra vez."}
    </p>
  </div>
);
