import Link from "next/link";
import type { ReactNode } from "react";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import type { Juego, Portada } from "@/lib/juegos/core";
import { focusRing } from "@/lib/ui";

export type TandaRowState = {
  /** «Nueva», «4 de 10», «Terminada». */
  chip: string;
  fresh: boolean;
  posters: string[];
};

/** Mayor o menor's row on the portada (FIL-I52-6): how many already played today's daily. */
export type GameRowState = { chip: string; fresh: boolean };

const rowClass =
  "flex min-h-[4.5rem] w-full items-center gap-3 border-t border-line py-2.5 text-left text-paper transition-colors";

const Glyph = ({ children }: { children: ReactNode }) => (
  <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-chrome text-fog">
    {children}
  </span>
);

const SoonGlyph = ({ id }: { id: string }) => (
  <Glyph>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-6">
      {id === "linea" ? (
        <>
          <path d="M3 12h18" />
          <circle cx="7" cy="12" r="2" />
          <circle cx="13" cy="12" r="2" />
          <circle cx="18.5" cy="12" r="2" />
        </>
      ) : id === "mayor" ? (
        <path d="M8 10l4-4 4 4M8 14l4 4 4-4" />
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
      ) : (
        <path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16l-5 2.9 1.2-5.5L4 9.6l5.6-.6z" />
      )}
    </svg>
  </Glyph>
);

const TandaGlyph = ({ posters }: { posters: string[] }) => (
  <Glyph>
    {posters.slice(0, 2).map((posterPath, index) => (
      <span
        key={posterPath}
        className={cn(
          "absolute top-2 h-10 w-7 overflow-hidden rounded-[5px] shadow-[0_6px_14px_-6px_rgba(0,0,0,.9)]",
          index === 0 ? "left-2 -rotate-[9deg]" : "left-[1.4rem] rotate-[8deg]",
        )}
      >
        <PosterImage name="" posterPath={posterPath} sizes="28px" tmdbSize="w185" ratio="fill" />
      </span>
    ))}
    {posters.length === 0 ? <span className="font-serif text-xl italic text-paper">10</span> : null}
  </Glyph>
);

const Chip = ({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" }) => (
  <span
    className={cn(
      "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
      tone === "accent" ? "border-accent/50 bg-accent/15 text-accent" : "border-line bg-chrome text-fog",
    )}
  >
    {children}
  </span>
);

const GameText = ({ juego, muted = false }: { juego: Juego; muted?: boolean }) => (
  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
    <b className={cn("text-base font-semibold", muted ? "text-mist" : "text-paper")}>{juego.name}</b>
    <span className="text-sm leading-snug text-fog">{juego.line}</span>
  </span>
);

/** The portada (board Juegos-3): the seasonal game on top, «Para hoy», «Próximamente». */
export const JuegosPortada = ({
  portada,
  tanda,
  rows = {},
  daily = [],
}: {
  portada: Portada;
  tanda: TandaRowState | null;
  /** Chips of the other playable games, by id. */
  rows?: Record<string, GameRowState>;
  /** Ids of the dailies: grouped in «Las diarias» (FIL-I54-5, board Comp-2-portada). */
  daily?: readonly string[];
}) => {
  const forToday = portada.playable.filter((juego) => !daily.includes(juego.id));
  const dailies = portada.playable.filter((juego) => daily.includes(juego.id));
  const playRow = (juego: Juego) => (
    <li key={juego.id}>
      <Link href={juego.href!} className={cn(rowClass, "hover:bg-white/[0.03]", focusRing)} data-juego={juego.id}>
        {juego.id === "tanda" ? <TandaGlyph posters={tanda?.posters ?? []} /> : <SoonGlyph id={juego.id} />}
        <GameText juego={juego} />
        {juego.id === "tanda" && tanda ? <Chip tone={tanda.fresh ? "accent" : "plain"}>{tanda.chip}</Chip> : null}
        {rows[juego.id] ? <Chip tone={rows[juego.id]!.fresh ? "accent" : "plain"}>{rows[juego.id]!.chip}</Chip> : null}
      </Link>
    </li>
  );
  return (
    <div className="flex flex-col gap-6">
      {portada.seasonal?.href ? (
        <Link
          href={portada.seasonal.href}
          className={cn(
            "block rounded-[1.6rem] border border-star/50 bg-[#221d11] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]",
            focusRing,
          )}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">De temporada</span>
          <h2 className="mt-2 font-serif text-[1.65rem] font-semibold leading-tight text-paper">{portada.seasonal.name}</h2>
          <p className="mt-1 text-sm text-fog">{portada.seasonal.line}</p>
        </Link>
      ) : null}

      {forToday.length > 0 ? (
        <section aria-labelledby="juegos-hoy">
          <h2 id="juegos-hoy" className="text-lg font-semibold text-paper">
            Para hoy
          </h2>
          <ul className="mt-1.5">{forToday.map(playRow)}</ul>
        </section>
      ) : null}

      {dailies.length > 0 ? (
        <section aria-labelledby="juegos-diarias" data-juegos="diarias">
          <h2 id="juegos-diarias" className="text-lg font-semibold text-paper">
            Las diarias
          </h2>
          <p className="text-sm text-fog">El mismo reto para todos, una vez al día.</p>
          <ul className="mt-1.5">{dailies.map(playRow)}</ul>
        </section>
      ) : null}

      {portada.soon.length > 0 ? (
        <section aria-labelledby="juegos-pronto">
          <h2 id="juegos-pronto" className="text-lg font-semibold text-paper">
            Próximamente
          </h2>
          <ul className="mt-1.5 border-b border-line">
            {portada.soon.map((juego) => (
              <li key={juego.id} className={cn(rowClass, "min-h-[4.25rem]")}>
                <SoonGlyph id={juego.id} />
                <GameText juego={juego} muted />
                <Chip>Pronto</Chip>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
