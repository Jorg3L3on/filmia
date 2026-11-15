import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { untilNextDaily } from "@/components/juegos/MayorDailyResult";
import { JuegosPortada, type GameRowState, type Marcador, type TandaRowState } from "@/components/juegos/JuegosPortada";
import { JuegosSeen } from "@/components/juegos/JuegosSeen";
import { TeTocaBlock } from "@/components/juegos/RetosUi";
import { mxToday } from "@/lib/cine-core";
import { BINGO_ID } from "@/lib/juegos/bingo/core";
import { loadBingo } from "@/lib/juegos/bingo/store";
import { DAILY_JUEGO_IDS, DUELOS_ID, JUEGOS, LIGA_ID, LIGA_PATH, portadaOf } from "@/lib/juegos/core";
import { DIARIA_IDS, DIARIAS } from "@/lib/juegos/diarias/core";
import { readDiaria } from "@/lib/juegos/diarias/store";
import { ESTRENOS_ID } from "@/lib/juegos/estrenos/core";
import { countOpenWithoutForecast } from "@/lib/juegos/estrenos/store";
import { ordinal } from "@/lib/juegos/liga/core";
import { ligaSummaryFor } from "@/lib/juegos/liga/store";
import { dailyLensOf, dayStreak, MAYOR_ID, MAYOR_LENSES, MAYOR_PATH } from "@/lib/juegos/mayor/core";
import { readDailyMayor } from "@/lib/juegos/mayor/store";
import { bestScoresByLens, countDailyPlayers, finishedDailyDays } from "@/lib/juegos/partidas";
import { listTeToca } from "@/lib/juegos/retos/store";
import { readTanda } from "@/lib/juegos/tanda/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Extras" } as const;

type JuegosSearchParams = Record<string, string | string[] | undefined>;

/** «Sábado 14 de noviembre». */
const dateLabelOf = (day: string) => {
  const label = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1).replace(",", "");
};

/** The eyebrow of Mayor o menor's daily on the big card: «Hoy toca año». */
const mayorEyebrow = (day: string) => {
  const lens = dailyLensOf(day);
  return lens === "imdb" ? "Hoy toca nota de IMDb" : lens === "critica" ? "Hoy toca crítica contra público" : `Hoy toca ${MAYOR_LENSES[lens].label.toLowerCase()}`;
};

/** Extras (FIL-I50-2, FIL-I56-2): the portada. Reached only from Hoy (its button and its second act). */
export default async function JuegosPage({ searchParams }: { searchParams: Promise<JuegosSearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const now = new Date();
  const today = mxToday(now);
  const portada = portadaOf(JUEGOS, today);
  const playableIds = new Set(portada.playable.map((juego) => juego.id));
  const desde = typeof params.desde === "string" ? params.desde : null;

  const tanda = await readTanda(userId, now).catch(() => null);
  const answered = tanda?.cards.filter((card) => card.answer).length ?? 0;
  const total = tanda?.cards.length ?? 0;
  const tandaRow: TandaRowState = {
    chip: total === 0 || answered === 0 ? "Nueva" : answered >= total ? "Terminada" : `${answered} de ${total}`,
    fresh: total === 0 || answered < total,
    posters: (tanda?.cards ?? []).flatMap((card) => (card.posterPath ? [card.posterPath] : [])).slice(0, 3),
    answered,
    total,
  };

  const rows: Record<string, GameRowState> = {};
  // «Te toca» (FIL-I53-1): retos waiting for the person, on top.
  const teToca = await listTeToca(userId, now).catch(() => []);
  if (playableIds.has(DUELOS_ID)) {
    rows[DUELOS_ID] = teToca.length > 0 ? { chip: teToca.length === 1 ? "1 te toca" : `${teToca.length} te tocan`, fresh: true } : { chip: "Sin retos", fresh: false };
  }
  if (playableIds.has(MAYOR_ID)) {
    const [mine, played] = await Promise.all([readDailyMayor(userId, today).catch(() => null), countDailyPlayers(MAYOR_ID, today).catch(() => 0)]);
    rows[MAYOR_ID] = {
      chip: mine?.finished ? `Hoy: ${mine.score} de ${mine.total}` : "Nueva",
      fresh: !mine?.finished,
      daily: {
        state: mine?.finished ? "played" : mine && mine.answers.length > 0 ? "half" : "new",
        answers: mine?.answers,
        score: mine?.score,
        total: mine?.total ?? 10,
        players: played,
        eyebrow: mayorEyebrow(today),
      },
    };
  }
  // FIL-I54-5: each daily says whether the person played it today and how many already did.
  await Promise.all(
    DIARIA_IDS.filter((id) => playableIds.has(id)).map(async (id) => {
      const [mine, played] = await Promise.all([readDiaria(userId, id, today).catch(() => null), countDailyPlayers(id, today).catch(() => 0)]);
      rows[id] = {
        chip: mine?.finishedAt ? `Hoy: ${mine.score} de ${DIARIAS[id].total}` : mine ? "A medias" : "Nueva",
        fresh: !mine?.finishedAt,
        daily: { state: mine?.finishedAt ? "played" : mine ? "half" : "new", score: mine?.score ?? undefined, total: DIARIAS[id].total, players: played },
      };
    }),
  );
  // FIL-I55: the quiniela and the bingo get a state; the liga goes to the marcador.
  if (playableIds.has(ESTRENOS_ID)) {
    const open = await countOpenWithoutForecast(userId, now).catch(() => 0);
    rows[ESTRENOS_ID] = open > 0 ? { chip: open === 1 ? "1 por pronosticar" : `${open} por pronosticar`, fresh: true } : { chip: "Al día", fresh: false };
  }
  if (playableIds.has(BINGO_ID)) {
    const bingo = await loadBingo(userId, now).catch(() => null);
    if (bingo) rows[BINGO_ID] = { chip: `${bingo.mine.squares} de 9`, fresh: bingo.mine.squares === 0 };
  }

  const dailyIds = DAILY_JUEGO_IDS.filter((id) => playableIds.has(id));
  const [days, records, liga] = await Promise.all([
    Promise.all(dailyIds.map((id) => finishedDailyDays(userId, id).catch(() => [] as string[]))),
    playableIds.has(MAYOR_ID) ? bestScoresByLens(userId, MAYOR_ID).catch(() => new Map<string, { best: number; played: number }>()) : null,
    playableIds.has(LIGA_ID) ? ligaSummaryFor(userId, now).catch(() => null) : undefined,
  ]);
  const imdbBest = records?.get("imdb")?.best ?? 0;
  const best = Math.max(0, ...[...(records?.values() ?? [])].map((record) => record.best));
  const marcador: Marcador = {
    dailiesPlayed: dailyIds.filter((id) => rows[id]?.daily?.state === "played").length,
    dailiesTotal: dailyIds.length,
    daysInRow: dayStreak(days.flat(), today),
    third: liga !== undefined ? { kind: "liga", place: liga ? ordinal(liga.place) : null, points: liga?.points ?? null, href: LIGA_PATH } : { kind: "best", value: best },
  };
  const shown = liga === undefined ? portada : { ...portada, playable: portada.playable.filter((juego) => juego.id !== LIGA_ID) };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3.5 pb-10">
      <NavLabel label="Extras" />
      <JuegosSeen entry={desde} />
      <div className="flex items-center gap-3">
        <BackDisc href="/" label="Volver a Hoy" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{dateLabelOf(today)}</p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">Extras</h1>
        </div>
      </div>
      <JuegosPortada
        portada={shown}
        marcador={marcador}
        teToca={teToca.length > 0 ? <TeTocaBlock items={teToca} now={now} /> : null}
        tanda={tandaRow}
        rows={rows}
        daily={DAILY_JUEGO_IDS}
        countdown={untilNextDaily(now)}
        libre={playableIds.has(MAYOR_ID) ? { href: MAYOR_PATH, best: imdbBest, lens: "IMDb" } : null}
      />
    </div>
  );
}
