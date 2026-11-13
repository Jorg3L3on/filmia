import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { JuegosPortada, type GameRowState, type TandaRowState } from "@/components/juegos/JuegosPortada";
import { JuegosSeen } from "@/components/juegos/JuegosSeen";
import { mxToday } from "@/lib/cine-core";
import { LigaCard } from "@/components/juegos/LigaCard";
import { BINGO_ID } from "@/lib/juegos/bingo/core";
import { loadBingo } from "@/lib/juegos/bingo/store";
import { DUELOS_ID, JUEGOS, LIGA_ID, portadaOf } from "@/lib/juegos/core";
import { ESTRENOS_ID } from "@/lib/juegos/estrenos/core";
import { countOpenWithoutForecast } from "@/lib/juegos/estrenos/store";
import { ligaSummaryFor } from "@/lib/juegos/liga/store";
import { MAYOR_ID } from "@/lib/juegos/mayor/core";
import { readDailyMayor } from "@/lib/juegos/mayor/store";
import { countDailyPlayers } from "@/lib/juegos/partidas";
import { listTeToca } from "@/lib/juegos/retos/store";
import { readTanda } from "@/lib/juegos/tanda/store";
import { TeTocaBlock } from "@/components/juegos/RetosUi";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Extras" } as const;

type JuegosSearchParams = Record<string, string | string[] | undefined>;

/** Extras (FIL-I50-2): the cartel. Reached only from Hoy (its button and its second act). */
export default async function JuegosPage({ searchParams }: { searchParams: Promise<JuegosSearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const now = new Date();
  const portada = portadaOf(JUEGOS, mxToday(now));
  const tanda = await readTanda(userId, now).catch(() => null);
  const answered = tanda?.cards.filter((card) => card.answer).length ?? 0;
  const total = tanda?.cards.length ?? 0;
  const tandaRow: TandaRowState = {
    chip: total === 0 || answered === 0 ? "Nueva" : answered >= total ? "Terminada" : `${answered} de ${total}`,
    fresh: total === 0 || answered === 0,
    posters: (tanda?.cards ?? []).flatMap((card) => (card.posterPath ? [card.posterPath] : [])).slice(0, 2),
  };
  const desde = typeof params.desde === "string" ? params.desde : null;
  const rows: Record<string, GameRowState> = {};
  // «Te toca» (FIL-I53-1, board Comp-2-portada): retos waiting for the person, on top.
  const teToca = await listTeToca(userId, now).catch(() => []);
  if (portada.playable.some((juego) => juego.id === DUELOS_ID)) {
    rows[DUELOS_ID] = teToca.length > 0 ? { chip: teToca.length === 1 ? "1 te toca" : `${teToca.length} te tocan`, fresh: true } : { chip: "Retar", fresh: false };
  }
  if (portada.playable.some((juego) => juego.id === MAYOR_ID)) {
    const today = mxToday(now);
    const [mine, played] = await Promise.all([
      readDailyMayor(userId, today).catch(() => null),
      countDailyPlayers(MAYOR_ID, today).catch(() => 0),
    ]);
    rows[MAYOR_ID] = mine?.finished
      ? { chip: `Hoy: ${mine.score} de ${mine.total}`, fresh: false }
      : { chip: played === 0 ? "Diaria nueva" : played === 1 ? "1 ya jugó" : `${played} ya jugaron`, fresh: true };
  }
  // FIL-I55: the quiniela and the bingo get a chip; the liga leaves the list for its own card on top.
  const playableIds = new Set(portada.playable.map((juego) => juego.id));
  if (playableIds.has(ESTRENOS_ID)) {
    const open = await countOpenWithoutForecast(userId, now).catch(() => 0);
    rows[ESTRENOS_ID] = open > 0 ? { chip: open === 1 ? "1 por pronosticar" : `${open} por pronosticar`, fresh: true } : { chip: "Al día", fresh: false };
  }
  if (playableIds.has(BINGO_ID)) {
    const bingo = await loadBingo(userId, now).catch(() => null);
    if (bingo) rows[BINGO_ID] = { chip: `${bingo.mine.squares} de 9`, fresh: bingo.mine.squares === 0 };
  }
  const liga = playableIds.has(LIGA_ID) ? await ligaSummaryFor(userId, now).catch(() => null) : undefined;
  const shown = liga === undefined ? portada : { ...portada, playable: portada.playable.filter((juego) => juego.id !== LIGA_ID) };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pb-10">
      <NavLabel label="Extras" />
      <JuegosSeen entry={desde} />
      <div className="flex items-center gap-3">
        <BackDisc href="/" label="Volver a Hoy" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Hoy</p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">Extras</h1>
        </div>
      </div>
      <TeTocaBlock items={teToca} now={now} />
      {liga !== undefined ? <LigaCard summary={liga} /> : null}
      <JuegosPortada portada={shown} tanda={tandaRow} rows={rows} />
    </div>
  );
}
