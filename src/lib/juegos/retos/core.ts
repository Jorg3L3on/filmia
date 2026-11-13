/**
 * Retos uno contra uno (FIL-I53). Pure: who can be challenged, when a reto expires, who won, the
 * history line between two people and the names shown. Nothing here touches the database.
 *
 * A reto is one person's finished partida sent to another account (or, for Mayor o menor, to a
 * link). The other person plays exactly the same content when they can; nobody plays live.
 */

export const DUELOS_PATH = "/extras/duelos";
export const RETAR_PATH = "/extras/retar";
export const retoPath = (retoId: string) => `/extras/retos/${retoId}`;
export const RETO_LINK_PREFIX = "/reto";
export const retoLinkPath = (token: string) => `${RETO_LINK_PREFIX}/${token}`;

/** A reto is open this long after it is sent; then it disappears for both, with no penalty. */
export const RETO_HOURS = 48;
export const RETO_MS = RETO_HOURS * 60 * 60 * 1000;
/** Open retos one person may have toward the same account at once (against harassment). */
export const RETO_MAX_OPEN_TO_SAME = 3;

export const RETO_JUEGO_IDS = ["mayor", "trivia", "gustos"] as const;
export type RetoJuegoId = (typeof RETO_JUEGO_IDS)[number];
export const parseRetoJuego = (value: unknown): RetoJuegoId | null =>
  RETO_JUEGO_IDS.includes(value as RetoJuegoId) ? (value as RetoJuegoId) : null;

export const RETO_JUEGOS: Record<RetoJuegoId, { name: string; line: string; unit: (score: number) => string }> = {
  mayor: {
    name: "Mayor o menor",
    line: "Muerte súbita: la misma secuencia, gana quien llega más lejos.",
    unit: (score) => `llegó a ${score}`,
  },
  trivia: {
    name: "Duelo de trivia",
    line: "Cinco preguntas iguales, 15 segundos cada una.",
    unit: (score) => `hizo ${score}`,
  },
  gustos: {
    name: "Duelo de gustos",
    line: "¿Cuál le gustó más a la otra persona?",
    unit: (score) => `adivinó ${score} de 7`,
  },
};

export type RetoStatus = "abierto" | "jugado" | "vencido" | "cancelado";

/** Open past its 48 hours (or never sent within them): it stops counting and stops showing. */
export const isRetoExpired = (reto: { status: string; expiresAt: Date }, now: Date) =>
  reto.status === "vencido" || (reto.status === "abierto" && reto.expiresAt.getTime() <= now.getTime());

/** Still waiting for someone: open and inside its 48 hours. */
export const isRetoOpen = (reto: { status: string; expiresAt: Date }, now: Date) =>
  reto.status === "abierto" && reto.expiresAt.getTime() > now.getTime();

export const expiresAtFrom = (sentAt: Date) => new Date(sentAt.getTime() + RETO_MS);

/** «Vence en 31 h», «Vence en 40 min». */
export const expiresLine = (expiresAt: Date, now: Date) => {
  const ms = Math.max(0, expiresAt.getTime() - now.getTime());
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Vence en ${hours} h`;
  return `Vence en ${Math.max(1, Math.ceil(ms / 60_000))} min`;
};

export type RetoOutcome = "from" | "to" | "empate";

/** Who won a finished reto: the higher score; the same score is a tie (Mayor o menor: the same pair). */
export const retoOutcome = (fromScore: number, toScore: number): RetoOutcome =>
  fromScore === toScore ? "empate" : fromScore > toScore ? "from" : "to";

export type HeadToHead = { mine: number; theirs: number; ties: number; played: number };

/**
 * The history between two people: finished retos only (an expired or cancelled one never counts).
 * `rows` are retos between them in any direction.
 */
export const headToHead = (
  rows: readonly { fromUserId: string; toUserId: string | null; status: string; fromScore: number | null; toScore: number | null }[],
  me: string,
): HeadToHead => {
  const out: HeadToHead = { mine: 0, theirs: 0, ties: 0, played: 0 };
  for (const row of rows) {
    if (row.status !== "jugado" || row.fromScore == null || row.toScore == null) continue;
    out.played += 1;
    const outcome = retoOutcome(row.fromScore, row.toScore);
    if (outcome === "empate") out.ties += 1;
    else if ((outcome === "from") === (row.fromUserId === me)) out.mine += 1;
    else out.theirs += 1;
  }
  return out;
};

/** «Van 3 a 2 a tu favor», «Nunca han jugado». */
export const headToHeadLine = (h2h: HeadToHead) => {
  if (h2h.played === 0) return "Nunca han jugado";
  if (h2h.mine === h2h.theirs) return `Van ${h2h.mine} a ${h2h.theirs}`;
  return h2h.mine > h2h.theirs ? `Van ${h2h.mine} a ${h2h.theirs} a tu favor` : `Van ${h2h.theirs} a ${h2h.mine} en tu contra`;
};

/** «4 a 2» from the person's side. */
export const headToHeadScore = (h2h: HeadToHead) => `${h2h.mine} a ${h2h.theirs}`;

/**
 * What a person is called among the accounts: the first name, and the initial of the second word
 * only when two people share a first name. Never the email.
 */
export const retoNames = (people: readonly { id: string; name: string | null }[]) => {
  const first = new Map(people.map((person) => [person.id, firstNameOf(person.name)]));
  const counts = new Map<string, number>();
  for (const name of first.values()) counts.set(name, (counts.get(name) ?? 0) + 1);
  return new Map(
    people.map((person) => {
      const name = first.get(person.id)!;
      if ((counts.get(name) ?? 0) < 2) return [person.id, name];
      const second = person.name?.trim().split(/\s+/)[1]?.slice(0, 1).toUpperCase();
      return [person.id, second ? `${name} ${second}.` : name];
    }),
  );
};

/** The first word of a name, never the email (same rule as `displayNameOf` in partidas.ts, kept pure here). */
export const firstNameOf = (name: string | null) => name?.trim().split(/\s+/)[0] || "Alguien";

export const initialOf = (name: string) => name.slice(0, 1).toUpperCase() || "?";

// ---------------------------------------------------------------------------
// Mayor o menor, muerte súbita (FIL-I53-2)
// ---------------------------------------------------------------------------

const COUNT_WORDS = ["Cero", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];
const countWord = (value: number) => COUNT_WORDS[value] ?? String(value);

export type SuddenDeathTrack = {
  /** Pair the person is on (1-based) and where the rival fell (1-based; null if they never fell). */
  myPair: number;
  rivalPair: number | null;
  /** Positions on the bar, 0–100. */
  mePct: number;
  rivalPct: number | null;
  /** «Dos más y le ganas. Si fallas aquí, gana Luis.» */
  line: string;
  label: string;
};

/**
 * The bar over a muerte súbita: the person's progress and the mark where the rival fell. `mine` is
 * how many the person got right so far (the pair on screen is `mine + 1`); `rivalScore` the
 * rival's streak, so they fell on pair `rivalScore + 1` unless they got through all `total`.
 */
export const suddenDeathTrack = (input: { rivalName: string; rivalScore: number; mine: number; total: number }): SuddenDeathTrack => {
  const rivalFell = input.rivalScore < input.total;
  const rivalPair = rivalFell ? input.rivalScore + 1 : null;
  const myPair = Math.min(input.mine + 1, input.total);
  const scale = Math.max(1, Math.min(input.total, Math.max((rivalPair ?? input.total) + 2, myPair + 2)));
  const pct = (pair: number) => Math.round((Math.min(pair, scale) / scale) * 1000) / 10;
  const name = input.rivalName;
  let line: string;
  if (input.mine > input.rivalScore) line = `Ya le ganaste a ${name}. Sigue hasta donde llegues.`;
  else if (input.mine === input.rivalScore) line = rivalFell ? `Si aciertas esta, le ganas. Si fallas, empatan.` : `${name} llegó al final. Si aciertas todas, empatan.`;
  else {
    const toWin = input.rivalScore - input.mine + 1;
    line = `${countWord(toWin)} más y le ganas. Si fallas aquí, gana ${name}.`;
  }
  return {
    myPair,
    rivalPair,
    mePct: pct(myPair),
    rivalPct: rivalPair == null ? null : pct(rivalPair),
    line,
    label: rivalPair == null ? `Vas en el par ${myPair}; ${name} no falló ninguno` : `Vas en el par ${myPair}; ${name} cayó en el ${rivalPair}`,
  };
};
