import { duoName, type PersonRole, type ThreadPerson, type ThreadPersonRole } from "@/lib/people/core";
import { personSourceKey } from "@/lib/rutas/core";

/**
 * «Tu universo» (FIL-I26-4, boards U1–U4): the people of the films you saw. Pure: nodes (one
 * per person, size = films of yours, «n de N»), islands (films joined by someone they share) and
 * bridges (someone who joins films by different directors). Islands come before bridges: with
 * three films there are usually none, and the hook is closing the smallest island.
 */

/** Drawn at most; the rest are counted, not drawn (phones). */
export const MAX_NODES = 60;

export type UniversoFilm = {
  catalogId: string;
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  watchedAt: Date;
  people: readonly ThreadPerson[];
};

export type UniversoNode = {
  /** One id, or two joined with «+» for a duo that made the same films. */
  key: string;
  personIds: number[];
  name: string;
  role: ThreadPersonRole;
  profilePath: string | null;
  /** Your films with them, oldest watch first. */
  films: string[];
  count: number;
  /** Their films in that role (Filmografía's count); null when unknown. */
  total: number | null;
  /** Joins films by different directors. */
  bridge: boolean;
};

export type Island = {
  /** The first film watched in it. */
  key: string;
  films: UniversoFilm[];
  nodes: UniversoNode[];
};

export type Universo = {
  films: number;
  people: number;
  islands: Island[];
  bridges: UniversoNode[];
  /** Nodes left out of the drawing (over `MAX_NODES`). */
  hidden: number;
};

const ROLE_RANK: Record<ThreadPersonRole, number> = { director: 0, dp: 1, composer: 2, cast: 3 };

export const ROLE_LABEL: Record<ThreadPersonRole, string> = {
  director: "Dirección",
  dp: "Fotografía",
  composer: "Música",
  cast: "Reparto",
};

/** `ThreadPersonRole` → the role key of a person ruta / Filmografía count. */
export const rutaRoleOf = (role: ThreadPersonRole) =>
  role === "director" ? "director" : role === "dp" ? "fotografia" : role === "composer" ? "musica" : "reparto";

const directorsOf = (film: UniversoFilm) =>
  film.people.filter((person) => person.role === "director").map((person) => person.id);

/**
 * Someone is a bridge when the films of yours they are in were not all made by one director:
 * Fraser joining PHM and Duna is a bridge; Jackson across his trilogy is the island itself.
 */
export const isBridge = (films: readonly UniversoFilm[]) => {
  if (films.length < 2) {
    return false;
  }
  const sets = films.map((film) => new Set(directorsOf(film)));
  const shared = [...(sets[0] ?? [])].filter((id) => sets.every((set) => set.has(id)));
  return shared.length === 0;
};

type PersonAcc = { person: ThreadPerson; films: UniversoFilm[] };

/** One node per person (their main role); a duo with exactly the same films and role becomes one. */
export const buildNodes = (
  films: readonly UniversoFilm[],
  totals: ReadonlyMap<number, number> = new Map(),
): UniversoNode[] => {
  const ordered = [...films].sort((a, b) => a.watchedAt.getTime() - b.watchedAt.getTime());
  const byPerson = new Map<number, PersonAcc>();
  for (const film of ordered) {
    for (const person of film.people) {
      const acc = byPerson.get(person.id);
      if (!acc) {
        byPerson.set(person.id, { person, films: [film] });
        continue;
      }
      if (!acc.films.includes(film)) {
        acc.films.push(film);
      }
      if (ROLE_RANK[person.role] < ROLE_RANK[acc.person.role]) {
        acc.person = person;
      }
    }
  }
  const nodes: UniversoNode[] = [];
  const merged = new Set<number>();
  const accs = [...byPerson.values()];
  for (const acc of accs) {
    if (merged.has(acc.person.id)) {
      continue;
    }
    const filmIds = acc.films.map((film) => film.catalogId);
    const partner =
      acc.person.role === "director"
        ? accs.find(
            (other) =>
              other !== acc &&
              !merged.has(other.person.id) &&
              other.person.role === "director" &&
              other.films.length === acc.films.length &&
              other.films.every((film) => filmIds.includes(film.catalogId)),
          )
        : undefined;
    if (partner) {
      merged.add(partner.person.id);
    }
    const personIds = partner ? [acc.person.id, partner.person.id] : [acc.person.id];
    nodes.push({
      key: personIds.join("+"),
      personIds,
      name: partner ? duoName(acc.person.name, partner.person.name) : acc.person.name,
      role: acc.person.role,
      profilePath: acc.person.profilePath ?? null,
      films: filmIds,
      count: acc.films.length,
      total: totals.get(acc.person.id) ?? null,
      bridge: isBridge(acc.films),
    });
  }
  return nodes;
};

/** Films joined by anyone they share (union-find); the biggest island first. */
export const buildIslands = (films: readonly UniversoFilm[], nodes: readonly UniversoNode[]): Island[] => {
  const parent = new Map(films.map((film) => [film.catalogId, film.catalogId]));
  const find = (id: string): string => {
    const up = parent.get(id) ?? id;
    if (up === id) {
      return id;
    }
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  for (const node of nodes) {
    for (const film of node.films.slice(1)) {
      parent.set(find(film), find(node.films[0]!));
    }
  }
  const groups = new Map<string, UniversoFilm[]>();
  const ordered = [...films].sort((a, b) => a.watchedAt.getTime() - b.watchedAt.getTime());
  for (const film of ordered) {
    const root = find(film.catalogId);
    groups.set(root, [...(groups.get(root) ?? []), film]);
  }
  return [...groups.values()]
    .map((group) => {
      const ids = new Set(group.map((film) => film.catalogId));
      return {
        key: group[0]!.catalogId,
        films: group,
        nodes: nodes
          .filter((node) => node.films.some((film) => ids.has(film)))
          .sort((a, b) => b.count - a.count || ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.name.localeCompare(b.name, "es")),
      };
    })
    .sort((a, b) => b.films.length - a.films.length || b.nodes.length - a.nodes.length);
};

/** The whole universe, drawn up to `MAX_NODES` (islands keep their biggest people first). */
export const buildUniverso = (
  films: readonly UniversoFilm[],
  totals: ReadonlyMap<number, number> = new Map(),
  maxNodes = MAX_NODES,
): Universo => {
  const nodes = buildNodes(films, totals);
  const islands = buildIslands(films, nodes);
  let budget = maxNodes;
  const drawn = islands.map((island) => {
    // Every island gets a share before the big ones take the rest.
    const share = Math.max(3, Math.floor(maxNodes / Math.max(1, islands.length)));
    const take = Math.min(island.nodes.length, Math.max(0, Math.min(share, budget)));
    budget -= take;
    return { ...island, nodes: island.nodes.slice(0, take) };
  });
  const shown = drawn.reduce((sum, island) => sum + island.nodes.length, 0);
  return {
    films: films.length,
    people: nodes.length,
    islands: drawn,
    bridges: nodes.filter((node) => node.bridge).sort((a, b) => b.count - a.count),
    hidden: nodes.length - shown,
  };
};

/** «Tres islas, ningún puente» and its plural forms. */
export const universoLine = (universo: Pick<Universo, "films" | "islands" | "bridges">) => {
  const islands = universo.islands.length;
  const bridges = universo.bridges.length;
  const bridgeWord = bridges === 0 ? "ningún puente" : bridges === 1 ? "un puente" : `${bridges} puentes`;
  return `${universo.films} ${universo.films === 1 ? "película" : "películas"} · ${islands} ${islands === 1 ? "isla" : "islas"} · ${bridgeWord}`;
};

export type ClosestIsland = { node: UniversoNode; left: number };

/**
 * «Cierra la más chica» (U2): the director (or duo) closest to complete, the fewest films left;
 * on a tie, the one you have seen most of. Only people whose «N» is known and not complete.
 */
export const closestIsland = (nodes: readonly UniversoNode[]): ClosestIsland | null => {
  let best: ClosestIsland | null = null;
  for (const node of nodes) {
    if (node.role !== "director" || node.total == null || node.count >= node.total) {
      continue;
    }
    const left = node.total - node.count;
    if (!best || left < best.left || (left === best.left && node.count > best.node.count)) {
      best = { node, left };
    }
  }
  return best;
};

/** How close a node is to complete, 0–1 (the ring around it); null when «N» is unknown. */
export const nodeProgress = (node: Pick<UniversoNode, "count" | "total">) =>
  node.total ? Math.min(1, node.count / node.total) : null;

export type BridgeCandidate = { tmdbId: number; name: string; releaseDate: string | null; people: readonly ThreadPerson[] };

/**
 * «La que más puentes abre» (U3): of a person's films you have not seen, the one whose other
 * people are most already yours or in their other films (Duna: Villeneuve, Zimmer, Chalamet come
 * back in Duna 2). The earlier one on a tie. Returns those people's names, the shared first.
 */
export const mostBridges = (
  candidates: readonly BridgeCandidate[],
  personIds: readonly number[],
  universePeople: ReadonlySet<number>,
): { film: BridgeCandidate; people: string[] } | null => {
  const exclude = new Set(personIds);
  let best: { film: BridgeCandidate; people: string[]; score: number } | null = null;
  for (const film of candidates) {
    const elsewhere = new Set(
      candidates.filter((other) => other !== film).flatMap((other) => other.people.map((person) => person.id)),
    );
    const linked = film.people.filter(
      (person) => !exclude.has(person.id) && (universePeople.has(person.id) || elsewhere.has(person.id)),
    );
    const names = [...new Map(linked.map((person) => [person.id, person.name])).values()];
    const score = names.length + linked.filter((person) => universePeople.has(person.id)).length;
    const earlier =
      best && score === best.score && (film.releaseDate ?? "9999") < (best.film.releaseDate ?? "9999");
    if (!best || score > best.score || earlier) {
      best = { film, people: names, score };
    }
  }
  return best && best.score > 0 ? { film: best.film, people: best.people } : null;
};

/**
 * A bridge that the film just seen made (U4): someone in it who was already in one of your films
 * by another director, and was not a bridge before. Crew first, then the most films.
 */
export const newBridge = (
  seen: UniversoFilm,
  others: readonly UniversoFilm[],
  alreadyShown: ReadonlySet<number>,
): { person: ThreadPerson; with: UniversoFilm[] } | null => {
  const candidates = seen.people
    .filter((person) => !alreadyShown.has(person.id))
    .map((person) => {
      const before = others.filter((film) => film.people.some((other) => other.id === person.id));
      return { person, before };
    })
    .filter(({ before }) => before.length > 0 && !isBridge(before) && isBridge([...before, seen]))
    .sort((a, b) => ROLE_RANK[a.person.role] - ROLE_RANK[b.person.role] || b.before.length - a.before.length);
  const pick = candidates[0];
  return pick ? { person: pick.person, with: pick.before } : null;
};

/** A film of the «Nuevo puente» sheet: enough for its poster and caption. */
export type BridgeFilm = { name: string; year: number | null; posterPath: string | null; tmdbId: number };

export type BridgeReveal = {
  personName: string;
  roleLabel: string;
  /** For the portrait (FIL-33): the TMDB person and their photo, if TMDB has one. */
  person: { id: number; profilePath: string | null };
  /** The film just seen first, then the ones it joins. */
  films: BridgeFilm[];
  /** «Dirigió las dos.» / «Sale en las tres.» */
  line: string;
  /** «Llevas n de sus N»: null when TMDB's total is unknown. */
  progress: { seen: number; total: number } | null;
  /** Their ruta, to start from the sheet. */
  ruta: { sourceKey: string; title: string; total: number | null } | null;
};

const BRIDGE_VERB: Record<ThreadPersonRole, string> = {
  director: "Dirigió",
  dp: "Fotografió",
  composer: "Puso la música de",
  cast: "Sale en",
};

/** «las dos», «las tres», then digits: «las 5». */
export const bridgeCountWords = (count: number) => (count === 2 ? "las dos" : count === 3 ? "las tres" : `las ${count}`);

/** Cast with more than this many titles get no ruta from the sheet: «Ver el universo» leads instead. */
export const BRIDGE_CAST_RUTA_MAX = 40;

/** The sheet's data from a found bridge (`newBridge`) and TMDB's total for the person. Pure. */
export const bridgeRevealOf = (
  seen: UniversoFilm,
  found: { person: ThreadPerson; with: readonly UniversoFilm[] },
  total: number | null,
): BridgeReveal => {
  const { person } = found;
  const films = [seen, ...found.with].map(({ name, year, posterPath, tmdbId }) => ({ name, year, posterPath, tmdbId }));
  return {
    personName: person.name,
    roleLabel: ROLE_LABEL[person.role].toLowerCase(),
    person: { id: person.id, profilePath: person.profilePath ?? null },
    films,
    line: `${BRIDGE_VERB[person.role]} ${bridgeCountWords(films.length)}.`,
    progress: total ? { seen: Math.min(films.length, total), total } : null,
    ruta:
      person.role === "cast" && total != null && total > BRIDGE_CAST_RUTA_MAX
        ? null
        : {
            sourceKey: personSourceKey([person.id], rutaRoleOf(person.role) as PersonRole),
            title: `Ruta de ${person.name}`,
            total,
          },
  };
};
