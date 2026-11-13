import Link from "next/link";
import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { PosterImage } from "@/components/PosterImage";
import { RetoAvatar } from "@/components/juegos/RetosUi";
import { cn } from "@/lib/cn";
import { mxToday } from "@/lib/cine-core";
import { BINGO_PATH, bingoCardOf, daysLeftInMonth, lineName, nearestLine } from "@/lib/juegos/bingo/core";
import { loadBingo, suggestForSquare } from "@/lib/juegos/bingo/store";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { monthName } from "@/lib/juegos/estrenos/core";
import { requireUserId } from "@/lib/session";
import { previewFichaHref } from "@/lib/title-preview";
import { buttonClass, focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bingo del mes" } as const;

type BingoSearchParams = Record<string, string | string[] | undefined>;

/**
 * Bingo del mes (FIL-I55-2, board G-1-bingo): nine squares, the same for everyone, ticked by the
 * films the person logs with a date this month. Computed on read; nothing is written.
 */
export default async function BingoPage({ searchParams }: { searchParams: Promise<BingoSearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const now = new Date();
  const today = mxToday(now);
  const view = await loadBingo(userId, now);
  const ticked = view.squares.map((square) => square.ticked);
  const nearest = nearestLine(ticked);

  // The selected square: the one asked for, else the first free one on the nearest line.
  const asked = Number(typeof params.casilla === "string" ? params.casilla : Number.NaN);
  const fallback = nearest?.line.find((index) => !ticked[index]) ?? view.squares.findIndex((square) => !square.ticked);
  const selected = Number.isInteger(asked) && asked >= 0 && asked < view.squares.length ? asked : fallback;
  const selectedSquare = selected >= 0 ? view.squares[selected] : undefined;
  const wantsSuggestions = params.ver === "1" && selectedSquare && !selectedSquare.ticked;
  const suggestions = wantsSuggestions ? await suggestForSquare(userId, bingoCardOf(view.month)[selected]!, now).catch(() => []) : [];

  const status =
    view.mine.lines > 0
      ? `Llevas ${view.mine.lines === 1 ? "una línea" : `${view.mine.lines} líneas`}.`
      : nearest
        ? nearest.missing === 1
          ? `Te falta una para ${lineName(nearest.line)}.`
          : `Te faltan ${nearest.missing} para ${lineName(nearest.line)}.`
        : "";
  const daysLeft = daysLeftInMonth(today);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-10">
      <NavLabel label="Bingo del mes" />
      <div className="flex items-center gap-3">
        <BackDisc href={JUEGOS_PATH} label="Volver a Extras" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-success">
            Entre todos · {daysLeft === 1 ? "último día" : `quedan ${daysLeft} días`}
          </p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">Bingo de {monthName(view.month)}</h1>
        </div>
      </div>

      <ol className="grid grid-cols-3 gap-2" aria-label="Cartón del mes">
        {view.squares.map((square) => (
          <li key={square.id}>
            <Link
              href={`${BINGO_PATH}?casilla=${square.index}`}
              scroll={false}
              aria-current={square.index === selected ? "true" : undefined}
              aria-label={`${square.label}: ${square.ticked ? `tachada con ${square.film?.name}` : "sin tachar"}`}
              className={cn(
                "relative flex aspect-[1/1.12] flex-col justify-end overflow-hidden rounded-2xl border p-2 text-[12.5px] font-semibold leading-tight",
                square.ticked ? "border-success/60 text-paper" : "border-line bg-surface text-paper",
                square.index === selected && !square.ticked && "border-accent ring-1 ring-accent",
                focusRing,
              )}
              data-bingo-square={square.id}
              data-ticked={square.ticked ? "1" : "0"}
            >
              {square.film ? (
                <>
                  <span className="absolute inset-0">
                    <PosterImage name={square.film.name} posterPath={square.film.posterPath} sizes="120px" tmdbSize="w185" ratio="fill" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" aria-hidden="true" />
                  <span className="relative">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mb-1 size-4 text-success">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                    {square.label}
                  </span>
                </>
              ) : (
                <span>{square.label}</span>
              )}
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-sm text-fog">
        Se tachan solas cuando registras una película con fecha de este mes; cada película tacha una casilla. {status}
      </p>

      {view.table.length > 0 ? (
        <section aria-labelledby="bingo-tabla" className="rounded-[1.4rem] border border-line bg-surface px-4 py-1.5">
          <h2 id="bingo-tabla" className="sr-only">
            Quién lleva más
          </h2>
          <ol>
            {view.table.map((row, index) => (
              <li key={row.userId} className={cn("flex min-h-14 items-center gap-3 py-2", index > 0 && "border-t border-line")} data-bingo-row={row.me ? "me" : "other"}>
                <span className={cn("w-5 text-center font-serif text-lg font-semibold tabular-nums", row.place === 1 ? "text-star" : "text-fog")}>{row.place}</span>
                <RetoAvatar initial={row.initial} seed={row.name} size="md" me={row.me} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-[15px] font-semibold text-paper">{row.name}</b>
                  {row.lines > 0 ? <span className="text-xs text-fog">{row.lines === 1 ? "1 línea" : `${row.lines} líneas`}</span> : null}
                </span>
                <span className="font-serif text-xl font-semibold tabular-nums text-paper">
                  {row.squares}
                  <span className="text-sm font-normal text-fog"> de 9</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="rounded-[1.4rem] border border-line bg-surface p-4 text-sm text-fog">Nadie ha tachado una casilla este mes. Registra una película con fecha y empiezas tú.</p>
      )}

      {selectedSquare && !selectedSquare.ticked ? (
        wantsSuggestions ? (
          <section id="que-ver" aria-labelledby="bingo-que-ver" className="scroll-mt-4">
            <h2 id="bingo-que-ver" className="text-lg font-semibold text-paper">
              Qué ver para «{selectedSquare.label}»
            </h2>
            {suggestions.length > 0 ? (
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {suggestions.map((film) => (
                  <li key={film.catalogId}>
                    <Link href={previewFichaHref(film.kind, film.tmdbId)} className={cn("flex flex-col gap-1", focusRing)}>
                      <span className="relative aspect-[2/3] overflow-hidden rounded-xl">
                        <PosterImage name={film.name} posterPath={film.posterPath} sizes="120px" tmdbSize="w185" ratio="fill" />
                      </span>
                      <span className="line-clamp-2 text-xs font-semibold leading-tight text-paper">{film.name}</span>
                      {film.year ? <span className="text-[11px] text-fog">{film.year}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-fog">No encontramos una que no hayas visto. Busca la tuya en Buscar.</p>
            )}
          </section>
        ) : (
          <Link
            href={`${BINGO_PATH}?casilla=${selected}&ver=1#que-ver`}
            className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}
            data-bingo="que-ver"
          >
            Qué ver para «{selectedSquare.label}»
          </Link>
        )
      ) : null}
    </div>
  );
}
