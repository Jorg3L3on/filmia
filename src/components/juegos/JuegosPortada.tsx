import Link from "next/link";
import type { ReactNode } from "react";
import { PosterImage } from "@/components/PosterImage";
import { ResultSquares } from "@/components/juegos/Piezas";
import { cn } from "@/lib/cn";
import type { Juego, Portada } from "@/lib/juegos/core";
import { buttonClass, focusRing } from "@/lib/ui";

/**
 * The portada of Extras (FIL-I56-2, boards P-1-portada and P-2-portada-hoy): a marcador, the first
 * daily still to play as a large card, the other dailies in a mosaic with their state, the rest
 * as cards, and the coming launches as a strip with their date. It only lays out what the page
 * computed; `portadaOf` decides what is playable.
 */

export type TandaRowState = {
  /** «Nueva», «4 de 10», «Terminada». */
  chip: string;
  fresh: boolean;
  posters: string[];
  answered?: number;
  total?: number;
};

/** A game's state on the portada: its chip, and for a daily how today went. */
export type GameRowState = {
  chip: string;
  fresh: boolean;
  /** Dailies: «played» shows the result, «half» «A medias», «new» «Nueva». */
  daily?: {
    state: "played" | "half" | "new";
    /** Mayor o menor: one square per pair. */
    answers?: boolean[];
    score?: number;
    total: number;
    /** Accounts that finished today's. */
    players: number;
    /** The big card's eyebrow, e.g. «Hoy toca año». */
    eyebrow?: string;
  };
};

export type Marcador = {
  dailiesPlayed: number;
  dailiesTotal: number;
  daysInRow: number;
  /** The league once it has launched; before, the best free streak. */
  third: { kind: "liga"; place: string | null; points: number | null; href: string } | { kind: "best"; value: number };
};

export type FreeStreak = { href: string; best: number; lens: string };

/** Each game its own drawing (no two share one). */
export const GameGlyph = ({ id, posters = [], large = false }: { id: string; posters?: string[]; large?: boolean }) => (
  <span
    className={cn(
      "relative grid shrink-0 place-items-center overflow-hidden border border-white/[0.14] bg-[#12161a] text-accent",
      large ? "h-[7.75rem] w-[6.5rem] rounded-[20px]" : "size-14 rounded-2xl",
    )}
    aria-hidden="true"
    data-glyph={id}
  >
    {id === "tanda" && posters.length > 0 ? (
      posters.slice(0, 3).map((posterPath, index) => (
        <span
          key={posterPath}
          className={cn(
            "absolute top-2.5 h-[39px] w-[26px] overflow-hidden rounded-[4px] shadow-[0_4px_10px_-4px_#000]",
            index === 0 ? "left-[5px] -rotate-12" : index === 1 ? "left-[15px] z-[1]" : "left-[25px] rotate-12",
          )}
        >
          <PosterImage name="" posterPath={posterPath} sizes="26px" tmdbSize="w185" ratio="fill" />
        </span>
      ))
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={large ? "size-11" : "size-6"}>
        {id === "tanda" ? (
          <text x="12" y="16.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="12" fontStyle="italic" style={{ fontFamily: "var(--font-serif)" }}>
            10
          </text>
        ) : id === "mayor" ? (
          <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
        ) : id === "duelos" ? (
          <>
            <rect x="3.5" y="5" width="7" height="14" rx="1.5" />
            <rect x="13.5" y="5" width="7" height="14" rx="1.5" />
          </>
        ) : id === "detalle" ? (
          <>
            <rect x="4" y="4" width="16" height="16" rx="2.5" strokeDasharray="3 3" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </>
        ) : id === "linea" ? (
          <>
            <path d="M3 12h18" />
            <circle cx="7" cy="12" r="2" />
            <circle cx="13" cy="12" r="2" />
            <circle cx="18.5" cy="12" r="2" />
          </>
        ) : id === "reparto" ? (
          <>
            <circle cx="8" cy="9" r="2.5" />
            <circle cx="16" cy="9" r="2.5" />
            <path d="M3.5 18c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4M11.5 18c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" />
          </>
        ) : id === "cuadricula" ? (
          <path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" />
        ) : id === "muro" ? (
          <>
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <rect x="13" y="13" width="7" height="7" rx="1.5" />
          </>
        ) : id === "estrenos" ? (
          <>
            <path d="M4 16h16M6 16v-3M10 16v-5M14 16v-3M18 16v-5" />
            <path d="M12 4v4M10 6l2 2 2-2" />
          </>
        ) : id === "bingo" ? (
          <>
            <rect x="4" y="4" width="16" height="16" rx="2.5" />
            <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
            <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
            <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
          </>
        ) : id === "liga" ? (
          <path d="M4 20v-6h5v6M9 20V9h6v11M15 20v-8h5v8M3 20h18" />
        ) : id === "quiniela" ? (
          <path d="M8 4h8v4a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 12v4M9 20h6M10 16h4v4h-4z" />
        ) : (
          <path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16l-5 2.9 1.2-5.5L4 9.6l5.6-.6z" />
        )}
      </svg>
    )}
  </span>
);

const chipClass = (tone: "plain" | "accent" | "gold" = "plain") =>
  cn(
    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
    tone === "accent" ? "border-accent/50 bg-accent/15 text-accent" : tone === "gold" ? "border-star/50 bg-star/15 text-star" : "border-line bg-chrome text-paper",
  );

const cardClass = "flex w-full items-center gap-3 rounded-[1.375rem] border border-line bg-surface p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)]";
const hiClass = "border-accent/50 bg-[linear-gradient(135deg,rgba(255,122,69,.15),rgba(255,122,69,0)_58%),var(--surface)]";

const SectionHead = ({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) => (
  <div className="mb-2 flex items-baseline justify-between gap-2.5">
    <h2 id={id} className="text-[17px] font-semibold text-paper">
      {title}
    </h2>
    {aside ? <span className="text-xs text-fog tabular-nums">{aside}</span> : null}
  </div>
);

const playersLine = (players: number) => (players === 0 ? "Nadie ha jugado hoy" : players === 1 ? "1 ya jugó" : `${players} ya jugaron`);

/** One tile of the mosaic: its drawing, name, state and today's result. */
const Tile = ({ juego, row, posters, wide = false }: { juego: Juego; row?: GameRowState; posters?: string[]; wide?: boolean }) => {
  const daily = row?.daily;
  const stateLine =
    daily?.state === "played" ? (
      <span className="text-xs font-semibold text-success tabular-nums">
        {daily.score} de {daily.total}
      </span>
    ) : daily?.state === "half" ? (
      <span className="text-xs font-semibold text-accent">A medias</span>
    ) : daily ? (
      <span className="text-xs font-semibold text-accent">Nueva</span>
    ) : row ? (
      <span className={cn("text-xs font-semibold", row.fresh ? "text-accent" : "text-fog")}>{row.chip}</span>
    ) : null;
  return (
    <Link
      href={juego.href!}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-[1.25rem] border border-line bg-surface p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)]",
        daily?.state === "half" && "border-accent/45",
        wide && "col-span-2",
        focusRing,
      )}
      data-juego={juego.id}
    >
      <span className="flex items-start gap-2.5">
        <GameGlyph id={juego.id} posters={posters} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-serif text-[17px] font-semibold leading-[1.1] text-paper">{juego.name}</span>
          {stateLine}
        </span>
      </span>
      {daily?.state === "played" && daily.answers ? (
        <ResultSquares answers={daily.answers} total={daily.total} size="wide" />
      ) : daily?.state === "played" && daily.score != null ? (
        <span className="h-1.5 overflow-hidden rounded-full bg-chrome" aria-hidden="true">
          <span className="block h-full rounded-full bg-success" style={{ width: `${Math.round((daily.score / daily.total) * 100)}%` }} />
        </span>
      ) : (
        <span className="line-clamp-2 text-xs leading-snug text-fog">{daily ? playersLine(daily.players) : juego.line}</span>
      )}
    </Link>
  );
};

/** «23 nov» from a `YYYY-MM-DD`. */
const shortDate = (day: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)).replace(".", "");

export const JuegosPortada = ({
  portada,
  marcador,
  teToca,
  tanda,
  rows = {},
  daily = [],
  countdown,
  libre,
}: {
  portada: Portada;
  marcador: Marcador;
  /** «Te toca»: retos waiting for the person, above everything else. */
  teToca?: ReactNode;
  tanda: TandaRowState | null;
  /** State of the playable games, by id. */
  rows?: Record<string, GameRowState>;
  /** Ids of the dailies, in cartel order. */
  daily?: readonly string[];
  /** «9 h 12 min» until the dailies change. */
  countdown: string;
  /** Mayor o menor's free streak, once Mayor o menor is playable. */
  libre: FreeStreak | null;
}) => {
  const dailies = portada.playable.filter((juego) => daily.includes(juego.id));
  const others = portada.playable.filter((juego) => !daily.includes(juego.id));
  const next = dailies.find((juego) => rows[juego.id]?.daily?.state !== "played") ?? null;
  const mosaic = dailies.filter((juego) => juego !== next);
  const weekly = others.filter((juego) => juego.id === "tanda" || juego.id === "duelos");
  const group = others.filter((juego) => !weekly.includes(juego));
  const { third } = marcador;
  const nextRow = next ? rows[next.id]?.daily : undefined;

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-3 gap-2" data-juegos="marcador">
        <a href="#juegos-diarias" className={cn("flex min-h-[4.75rem] flex-col justify-center gap-1 rounded-[1.125rem] border border-line bg-surface px-3 py-2.5", focusRing)}>
          <b className="font-serif text-[26px] font-semibold leading-none text-paper tabular-nums">
            {marcador.dailiesPlayed}
            <span className="font-sans text-sm font-normal text-fog"> de {marcador.dailiesTotal}</span>
          </b>
          <span className="text-xs leading-tight text-fog">{marcador.dailiesTotal === 1 ? "diaria de hoy" : "diarias de hoy"}</span>
        </a>
        <div className="flex min-h-[4.75rem] flex-col justify-center gap-1 rounded-[1.125rem] border border-line bg-surface px-3 py-2.5">
          <b className="font-serif text-[26px] font-semibold leading-none text-paper tabular-nums">{marcador.daysInRow}</b>
          <span className="text-xs leading-tight text-fog">{marcador.daysInRow === 1 ? "día seguido" : "días seguidos"}</span>
        </div>
        {third.kind === "liga" ? (
          <Link href={third.href} className={cn("flex min-h-[4.75rem] flex-col justify-center gap-1 rounded-[1.125rem] border border-line bg-surface px-3 py-2.5", focusRing)} data-liga="portada">
            <b className={cn("font-serif text-[26px] font-semibold leading-none tabular-nums", third.place ? "text-star" : "text-fog")}>{third.place ?? "—"}</b>
            <span className="text-xs leading-tight text-fog">{third.points != null ? `en la liga · ${third.points} pts` : "en la liga"}</span>
          </Link>
        ) : (
          <div className="flex min-h-[4.75rem] flex-col justify-center gap-1 rounded-[1.125rem] border border-line bg-surface px-3 py-2.5">
            <b className="font-serif text-[26px] font-semibold leading-none text-star tabular-nums">{third.value}</b>
            <span className="text-xs leading-tight text-fog">tu mejor racha</span>
          </div>
        )}
      </div>

      {teToca ? <div className="mt-3">{teToca}</div> : null}

      {dailies.length > 0 ? (
        <section aria-labelledby="juegos-diarias" className="mt-5 scroll-mt-4" data-juegos="diarias">
          <SectionHead id="juegos-diarias" title={dailies.length === 1 ? "La diaria" : "Las diarias"} aside={`cambia${dailies.length === 1 ? "" : "n"} en ${countdown}`} />
          {next ? (
            <Link href={next.href!} className={cn(cardClass, hiClass, "items-stretch", focusRing)} data-juego={next.id} data-juegos="siguiente">
              <GameGlyph id={next.id} large />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  {nextRow?.state === "half" ? "A medias" : (nextRow?.eyebrow ?? (mosaic.some((juego) => rows[juego.id]?.daily?.state === "played") ? "Sigue esta" : "Hoy toca"))}
                </span>
                <span className="font-serif text-[23px] font-semibold leading-[1.1] text-paper">{next.name}</span>
                <span className="text-sm leading-snug text-fog">{next.line}</span>
                <span className="flex-1" />
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs text-fog">{playersLine(nextRow?.players ?? 0)}</span>
                  <span className={buttonClass({ variant: "primary", size: "md", className: "pointer-events-none min-h-10 px-5" })}>
                    {nextRow?.state === "half" ? "Seguir" : "Jugar"}
                  </span>
                </span>
              </span>
            </Link>
          ) : null}
          {mosaic.length > 0 ? (
            <div className={cn("grid grid-cols-2 gap-2.5", next && "mt-2.5")}>
              {mosaic.map((juego, index) => (
                <Tile key={juego.id} juego={juego} row={rows[juego.id]} wide={mosaic.length % 2 === 1 && index === mosaic.length - 1} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {weekly.length > 0 || libre ? (
        <section aria-labelledby="juegos-hoy" className="mt-5">
          <SectionHead id="juegos-hoy" title="También hoy" />
          {weekly.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {weekly.map((juego) =>
                juego.id === "tanda" ? (
                  <Tile key={juego.id} juego={juego} posters={tanda?.posters} row={tanda ? { chip: tanda.chip, fresh: tanda.fresh } : undefined} />
                ) : (
                  <Tile key={juego.id} juego={juego} row={rows[juego.id]} />
                ),
              )}
            </div>
          ) : null}
          {libre ? (
            <Link href={libre.href} className={cn(cardClass, "mt-2.5 py-2.5", focusRing)} data-juego="libre">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/[0.14] bg-[#12161a] text-star" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-6">
                  <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
                </svg>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-serif text-[17px] font-semibold leading-[1.1] text-paper">Racha libre</span>
                <span className="text-sm text-fog">
                  {libre.best > 0 ? (
                    <>
                      Mayor o menor sin límite · récord <b className="font-semibold text-star">{libre.best}</b>
                    </>
                  ) : (
                    "Mayor o menor sin límite"
                  )}
                </span>
              </span>
              <span className={chipClass()}>Jugar</span>
            </Link>
          ) : null}
        </section>
      ) : null}

      {group.length > 0 ? (
        <section aria-labelledby="juegos-grupo" className="mt-5">
          <SectionHead id="juegos-grupo" title="Con tu grupo" />
          <div className="grid grid-cols-2 gap-2.5">
            {group.map((juego) => (
              <Tile key={juego.id} juego={juego} row={rows[juego.id]} />
            ))}
          </div>
        </section>
      ) : null}

      {portada.seasonal?.href ? (
        <section aria-labelledby="juegos-temporada" className="mt-5">
          <SectionHead id="juegos-temporada" title="De temporada" />
          <Link
            href={portada.seasonal.href}
            className={cn(cardClass, "border-star/45 bg-[linear-gradient(135deg,rgba(240,193,74,.13),rgba(240,193,74,0)_58%),var(--surface)]", focusRing)}
            data-juego={portada.seasonal.id}
          >
            <GameGlyph id={portada.seasonal.id} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-serif text-[19px] font-semibold leading-[1.1] text-paper">{portada.seasonal.name}</span>
              <span className="line-clamp-2 text-sm text-fog">{portada.seasonal.line}</span>
            </span>
            <span className={chipClass("gold")}>Boleta</span>
          </Link>
        </section>
      ) : null}

      {portada.soon.length > 0 ? (
        <section aria-labelledby="juegos-pronto" className="mt-5" data-juegos="pronto">
          <SectionHead id="juegos-pronto" title="Próximos estrenos" aside="uno por semana" />
          <ul className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {[...portada.soon]
              .sort((a, b) => (a.launchedOn ?? "9999").localeCompare(b.launchedOn ?? "9999"))
              .map((juego) => (
                <li
                  key={juego.id}
                  className="flex h-[5.25rem] w-28 shrink-0 snap-start flex-col justify-between rounded-[18px] border border-dashed border-[#3a4452] px-[11px] py-2.5"
                  data-juego={juego.id}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-star">{juego.launchedOn ? shortDate(juego.launchedOn) : "Pronto"}</span>
                  <b className="line-clamp-2 text-[13px] font-semibold leading-[1.2] text-paper">{juego.name}</b>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
