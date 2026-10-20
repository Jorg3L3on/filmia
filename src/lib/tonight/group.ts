import type { Platform } from "@/db";
import { affinityScore, type AffinityScorer } from "@/lib/tonight/affinity";
import { closestAnchor } from "@/lib/tonight/profile";
import { ANCHOR_MIN_SIMILARITY, joinEs } from "@/lib/tonight/score";
import type { TonightTitle } from "@/lib/tonight/types";

/**
 * FIL-I19-1 · «Qué vemos juntos»: one ranking for the people watching tonight.
 * Average without misery: a film anyone would put in «Fuera de tu zona» is out
 * (veto), the rest go by the mean of everyone's score on their own scale, ties
 * by the least happy person, then by confidence. Pure; the store resolves
 * libraries, scorers, candidates and platforms.
 *
 * Readers never get here: the caller passes only the owner and editors who are
 * watching tonight (pinned decision). Reasons name people and films they liked,
 * never a rating.
 */

export type GroupMember = {
  id: string;
  /** First name, for the reasons. */
  name: string;
  /** Null in cold start (< AFFINITY_MIN_RATED rated): no veto, no vote, flagged. */
  scorer: AffinityScorer | null;
  /** Catalog ids this person already watched. */
  watched: ReadonlySet<string>;
  /** `User.streamingPlatforms`. */
  platforms: readonly Platform[];
  /** The person looking at the page: reasons say «a ti» instead of their name. */
  self?: boolean;
};

export type GroupCandidate = {
  catalogId: string;
  /** The film as the engine reads it (`filmAsTitle`). */
  title: TonightTitle;
  inList: boolean;
  /** Flatrate MX platforms the film is on (from `Catalog.watchProvidersMx`). */
  platforms: readonly Platform[];
};

export type GroupReason = { memberIds: string[]; text: string };

export type GroupPick = {
  catalogId: string;
  inList: boolean;
  /** Mean normalized score (0–1) over members with a scorer. */
  score: number;
  /** The least happy member's score. */
  min: number;
  confidence: number;
  /** Platforms of the people watching that carry it. */
  platforms: Platform[];
  /** In the list but on none of their platforms. */
  offPlatforms: boolean;
  /** Members who would put it «Fuera de tu zona» (only > 0 in relaxed mode). */
  vetoedBy: string[];
  reasons: GroupReason[];
};

export type GroupResult =
  | {
      status: "ok";
      picks: GroupPick[];
      /** Everything was vetoed: picks allow one veto and say so. */
      relaxed: boolean;
      /** Members in cold start, left out of the vote. */
      cold: string[];
      /** No one watching has platforms set: availability was not filtered. */
      platformsUnknown: boolean;
    }
  | { status: "few_ratings"; cold: string[] }
  | { status: "no_platform"; cold: string[] };

/** Members with a scorer needed for a group answer. */
export const GROUP_MIN_SCORED = 2;
export const GROUP_PICK_LIMIT = 12;
export const GROUP_REASONS_PER_MEMBER = 2;
export const GROUP_MAX_WATCHING = 6;

type Scored = GroupPick;

const reasonsFor = (
  candidate: GroupCandidate,
  members: readonly GroupMember[],
  vectors: ReadonlyMap<string, ReturnType<typeof affinityScore>>,
): GroupReason[] => {
  // «A los 2 les gustó Zodiac»: people sharing the same anchor get one line.
  const byAnchor = new Map<string, { name: string; memberIds: string[] }>();
  const people = new Map<number, { name: string; memberIds: string[] }>();
  const genres = new Map<string, string[]>();
  for (const member of members) {
    const score = vectors.get(member.id);
    if (!member.scorer || !score) {
      continue;
    }
    const { profile } = member.scorer.ctx;
    let count = 0;
    const anchor = closestAnchor(profile, score.vector);
    if (
      anchor &&
      anchor.similarity >= ANCHOR_MIN_SIMILARITY &&
      anchor.anchor.name !== candidate.title.name
    ) {
      const key = anchor.anchor.name;
      const entry = byAnchor.get(key) ?? { name: key, memberIds: [] };
      entry.memberIds.push(member.id);
      byAnchor.set(key, entry);
      count += 1;
    }
    for (const person of candidate.title.people) {
      if (count >= GROUP_REASONS_PER_MEMBER) {
        break;
      }
      if (person.role === "cast") {
        continue;
      }
      const known = profile.people.get(person.id);
      if (known && known.count >= 2 && (known.avgRating == null || known.avgRating >= profile.mean)) {
        const entry = people.get(person.id) ?? { name: person.name, memberIds: [] };
        entry.memberIds.push(member.id);
        people.set(person.id, entry);
        count += 1;
        break;
      }
    }
    if (count < GROUP_REASONS_PER_MEMBER) {
      const liked = candidate.title.genres
        .filter((genre) => (profile.genreAffinity.get(genre.id) ?? 0) > 0.25)
        .map((genre) => genre.name.toLowerCase());
      if (liked.length > 0) {
        const key = liked.slice(0, 2).join("|");
        const entry = genres.get(key) ?? [];
        entry.push(member.id);
        genres.set(key, entry);
      }
    }
  }

  const memberOf = new Map(members.map((member) => [member.id, member]));
  // «A los 2», «A ti», «A Ana», «A ti y a Ana»; the pronoun follows: te / le / les.
  const who = (ids: string[]) => {
    if (ids.length === members.length && ids.length > 1) {
      return `A los ${ids.length}`;
    }
    const names = ids.map((id) => (memberOf.get(id)?.self ? "ti" : (memberOf.get(id)?.name ?? "alguien")));
    return `A ${names.length > 1 ? `${names.slice(0, -1).join(", a ")} y a ${names.at(-1)}` : names[0]}`;
  };
  const pronoun = (ids: string[]) => (ids.length > 1 ? "les" : memberOf.get(ids[0])?.self ? "te" : "le");
  const reasons: GroupReason[] = [];
  for (const entry of byAnchor.values()) {
    reasons.push({
      memberIds: entry.memberIds,
      text: `${who(entry.memberIds)} ${pronoun(entry.memberIds)} gustó ${entry.name}`,
    });
  }
  for (const entry of people.values()) {
    const role = candidate.title.kind === "SERIES" ? "Creada" : "Dirigida";
    reasons.push({
      memberIds: entry.memberIds,
      text: `${role} por ${entry.name}: ${who(entry.memberIds).replace(/^A /, "a ")} ${pronoun(entry.memberIds)} gusta su cine`,
    });
  }
  for (const [key, ids] of genres) {
    reasons.push({
      memberIds: ids,
      text: `${who(ids)} ${pronoun(ids)} gusta ${joinEs(key.split("|"))}`,
    });
  }
  // The shared reasons first: they are the point of watching together.
  return reasons.sort((a, b) => b.memberIds.length - a.memberIds.length).slice(0, 3);
};

/** The top this many keep room for the list (canvas 2, «Mezcla»). */
export const GROUP_MIX_TOP = 5;
export const GROUP_MIX_LISTED = 2;

/**
 * At least two «En la lista» in the top five when the list has them: the list is
 * what they chose together, suggestions should not bury it. The best listed films
 * move up into the last slots; the order stays otherwise.
 */
export const mixListed = <T extends { inList: boolean; offPlatforms: boolean }>(sorted: readonly T[]): T[] => {
  const top = sorted.slice(0, GROUP_MIX_TOP);
  const missing = GROUP_MIX_LISTED - top.filter((pick) => pick.inList).length;
  if (missing <= 0) {
    return [...sorted];
  }
  const promoted = sorted
    .slice(GROUP_MIX_TOP)
    .filter((pick) => pick.inList && !pick.offPlatforms)
    .slice(0, missing);
  if (promoted.length === 0) {
    return [...sorted];
  }
  const keep = top.length - promoted.length;
  const kept = [...top.filter((pick) => pick.inList), ...top.filter((pick) => !pick.inList)].slice(0, keep);
  const head = top.filter((pick) => kept.includes(pick));
  const moved = new Set<T>([...head, ...promoted]);
  return [...head, ...promoted, ...sorted.filter((pick) => !moved.has(pick))];
};

/** Rank candidates for the people watching tonight. Pure. */
export const rankForGroup = (
  members: readonly GroupMember[],
  candidates: readonly GroupCandidate[],
  limit = GROUP_PICK_LIMIT,
): GroupResult => {
  const cold = members.filter((member) => !member.scorer).map((member) => member.id);
  const scoredMembers = members.filter((member) => member.scorer);
  if (scoredMembers.length < GROUP_MIN_SCORED) {
    return { status: "few_ratings", cold };
  }

  const watchedByAnyone = new Set<string>();
  for (const member of members) {
    for (const id of member.watched) {
      watchedByAnyone.add(id);
    }
  }
  const theirPlatforms = new Set(members.flatMap((member) => member.platforms));
  const platformsUnknown = theirPlatforms.size === 0;

  const seen = new Set<string>();
  const scored: Scored[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.catalogId) || watchedByAnyone.has(candidate.catalogId)) {
      continue;
    }
    seen.add(candidate.catalogId);
    const platforms = candidate.platforms.filter((platform) => theirPlatforms.has(platform));
    const offPlatforms = !platformsUnknown && platforms.length === 0;
    // New suggestions only when someone watching can stream them.
    if (offPlatforms && !candidate.inList) {
      continue;
    }
    const scores = new Map<string, ReturnType<typeof affinityScore>>();
    const vetoedBy: string[] = [];
    for (const member of scoredMembers) {
      const score = affinityScore(member.scorer!, candidate.title);
      scores.set(member.id, score);
      if (score.level === "baja") {
        vetoedBy.push(member.id);
      }
    }
    const values = [...scores.values()];
    scored.push({
      catalogId: candidate.catalogId,
      inList: candidate.inList,
      score: values.reduce((sum, value) => sum + value.normalized, 0) / values.length,
      min: Math.min(...values.map((value) => value.normalized)),
      confidence: values.reduce((sum, value) => sum + value.confidence, 0) / values.length,
      platforms,
      offPlatforms,
      vetoedBy,
      reasons: reasonsFor(candidate, scoredMembers, scores),
    });
  }

  if (scored.length === 0) {
    return { status: "no_platform", cold };
  }

  let pool = scored.filter((pick) => pick.vetoedBy.length === 0);
  let relaxed = false;
  if (pool.length === 0) {
    pool = scored.filter((pick) => pick.vetoedBy.length <= 1);
    relaxed = true;
  }

  pool.sort(
    (a, b) =>
      Number(a.offPlatforms) - Number(b.offPlatforms) ||
      b.score - a.score ||
      b.min - a.min ||
      b.confidence - a.confidence,
  );

  return {
    status: "ok",
    picks: mixListed(pool).slice(0, limit),

    relaxed,
    cold,
    platformsUnknown,
  };
};
