/**
 * TMDB people for a title: who made it and who is in it, with what the ficha
 * rail needs (photo, character, cinematographer). Stored as-is in
 * `Catalog.tmdbPeople` (jsonb). Esta noche reads the same column through
 * `parseStoredPeople`, which ignores `dp` and the extra fields, and caps cast
 * at five itself, so the taste vector does not move.
 */

export type TmdbPersonRole = "director" | "creator" | "dp" | "cast";

export type TmdbPerson = {
  id: number;
  name: string;
  role: TmdbPersonRole;
  /** TMDB profile path; null when TMDB has no photo. Absent on rows stored before photos. */
  profilePath?: string | null;
  /** Cast only: who they play («Ellie»). */
  character?: string | null;
  /** Cast only: billing order after sorting (0 = top-billed). */
  order?: number;
};

export const TMDB_CAST_LIMIT = 8;
export const TMDB_DP_LIMIT = 2;

const DP_JOB = "Director of Photography";

type TmdbCastMember = {
  id?: number;
  name?: string;
  order?: number;
  total_episode_count?: number;
  profile_path?: string | null;
  character?: string;
  roles?: Array<{ character?: string; episode_count?: number }>;
};

type TmdbCrewMember = {
  id?: number;
  name?: string;
  job?: string;
  jobs?: Array<{ job?: string; episode_count?: number }>;
  total_episode_count?: number;
  profile_path?: string | null;
};

export type TmdbCreditsPayload = {
  cast?: TmdbCastMember[];
  crew?: TmdbCrewMember[];
};

export type TmdbCreatedBy = Array<{ id?: number; name?: string; profile_path?: string | null }>;

const cleanPath = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const cleanText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const jobsOf = (member: TmdbCrewMember) =>
  member.jobs?.map((item) => item.job) ?? [member.job];

/** Movies carry `character`; TV aggregate credits list `roles`, most episodes first. */
const characterOf = (member: TmdbCastMember) => {
  if (member.character !== undefined) {
    return cleanText(member.character);
  }
  const roles = [...(member.roles ?? [])].sort(
    (a, b) => (b.episode_count ?? 0) - (a.episode_count ?? 0),
  );
  return cleanText(roles.find((role) => cleanText(role.character))?.character);
};

/**
 * Creators, directors, up to eight cast and the cinematographer(s).
 * Order of the pushes matters for Esta noche: cast is deduplicated only
 * against creators and directors (as before), so its first five never change;
 * a DP who is already listed keeps their first role.
 */
export const parseTmdbPeople = (
  credits: TmdbCreditsPayload | null | undefined,
  createdBy: TmdbCreatedBy | undefined,
): TmdbPerson[] => {
  const people: TmdbPerson[] = [];
  const seen = new Set<number>();
  const push = (id: unknown, name: string | undefined, person: Omit<TmdbPerson, "id" | "name">) => {
    const numeric = Number(id);
    const label = name?.trim();
    if (!Number.isInteger(numeric) || numeric <= 0 || !label || seen.has(numeric)) {
      return false;
    }
    seen.add(numeric);
    people.push({ id: numeric, name: label, ...person });
    return true;
  };

  for (const person of createdBy ?? []) {
    push(person.id, person.name, { role: "creator", profilePath: cleanPath(person.profile_path) });
  }
  for (const member of credits?.crew ?? []) {
    if (jobsOf(member).some((job) => job === "Director")) {
      push(member.id, member.name, { role: "director", profilePath: cleanPath(member.profile_path) });
    }
  }

  const cast = [...(credits?.cast ?? [])].sort((a, b) => {
    const episodes = (b.total_episode_count ?? 0) - (a.total_episode_count ?? 0);
    if (episodes !== 0) {
      return episodes;
    }
    return (a.order ?? 999) - (b.order ?? 999);
  });
  let castCount = 0;
  for (const member of cast) {
    if (castCount >= TMDB_CAST_LIMIT) {
      break;
    }
    const added = push(member.id, member.name, {
      role: "cast",
      profilePath: cleanPath(member.profile_path),
      character: characterOf(member),
      order: castCount,
    });
    if (added) {
      castCount += 1;
    }
  }

  const cinematographers = (credits?.crew ?? [])
    .filter((member) => jobsOf(member).some((job) => job === DP_JOB))
    .sort((a, b) => (b.total_episode_count ?? 0) - (a.total_episode_count ?? 0));
  let dpCount = 0;
  for (const member of cinematographers) {
    if (dpCount >= TMDB_DP_LIMIT) {
      break;
    }
    if (push(member.id, member.name, { role: "dp", profilePath: cleanPath(member.profile_path) })) {
      dpCount += 1;
    }
  }

  return people;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRole = (value: unknown): value is TmdbPersonRole =>
  value === "director" || value === "creator" || value === "dp" || value === "cast";

/** Every stored shape, old (`{id, name, role}`, five cast) and new; junk entries are dropped. */
export const parseStoredTmdbPeople = (value: unknown): TmdbPerson[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const people: TmdbPerson[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const id = Number(item.id);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!Number.isInteger(id) || id <= 0 || !name || !isRole(item.role)) {
      continue;
    }
    const person: TmdbPerson = { id, name, role: item.role };
    if ("profilePath" in item) {
      person.profilePath = typeof item.profilePath === "string" ? cleanPath(item.profilePath) : null;
    }
    if (typeof item.character === "string") {
      person.character = cleanText(item.character);
    }
    if (typeof item.order === "number" && Number.isInteger(item.order)) {
      person.order = item.order;
    }
    people.push(person);
  }
  return people;
};

/**
 * True for rows stored before photos and the DP existed: they have people but
 * none carries a `profilePath` key (new rows always do, null included).
 */
export const tmdbPeopleNeedUpgrade = (value: unknown) => {
  const people = parseStoredTmdbPeople(value);
  return people.length > 0 && people.every((person) => person.profilePath === undefined);
};

/**
 * Patch for an old row: the fresh list, but only when TMDB returned people.
 * Never writes an empty list over stored people (FIL-I1: the catalog is shared).
 */
export const tmdbPeopleUpgrade = (stored: unknown, fetched: readonly TmdbPerson[] | null | undefined) => {
  if (!fetched || fetched.length === 0) {
    return null;
  }
  if (parseStoredTmdbPeople(stored).length > 0 && !tmdbPeopleNeedUpgrade(stored)) {
    return null;
  }
  return [...fetched];
};
