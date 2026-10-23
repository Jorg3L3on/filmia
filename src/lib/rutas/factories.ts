import { and, eq } from "drizzle-orm";
import { catalog, cinemaReleases, db, listItems, lists, titles, users, type Platform } from "@/db";
import { formatShortDay } from "@/lib/cine-core";
import { bestCuratedDraft, curatedRutaDraft, loadCuratedLists } from "@/lib/rutas/curadas";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { FAVORITAS_SLUG } from "@/lib/lists";
import {
  collectionRutaDraft,
  duoName,
  isDuo,
  parseSourceKey,
  parseThreadPeople,
  PERSON_FULL_MAX,
  personRoleFilms,
  personRoleOfThread,
  personRutaDraft,
  personSourceKey,
  rankSeeds,
  TITLE_RUTA_MIN_VOTES,
  titleSourceKey,
  TITLE_RUTA_SIZE,
  titleRutaDraft,
  todayIso,
  type PersonRutaRole,
  type RutaDraft,
  type RutaFilm,
  type SeedCandidate,
  type ThreadPerson,
} from "@/lib/rutas/core";
import {
  createRuta,
  loadSourceKeys,
  markRutasOffered,
  rutasAlreadyOffered,
  type CreatedRuta,
  type RutaVia,
  type RutaView,
} from "@/lib/rutas/store";
import { parseStoredStreamingPlatforms, titleAvailableOnUserPlatforms } from "@/lib/streaming-platforms";
import {
  getTmdbCollection,
  getTmdbMovieCollectionRef,
  getTmdbPersonCredits,
  getTmdbRelated,
  isTmdbConfigured,
} from "@/lib/tmdb";
import { fetchMxWatchProviders } from "@/lib/watch-providers";

/**
 * The ruta factories that need TMDB (FIL-I26-1): por colección (a film's TMDB collection in
 * order) and por persona (Filmografía's count: whole when ≤ 8, «esenciales» otherwise). Every
 * response goes through the 24 h metadata cache, and nothing here runs while Hoy is read unless
 * the person has never had a ruta.
 */

export type SeedTitle = SeedCandidate & {
  people: ThreadPerson[];
  genreIds: number[];
  posterPath: string | null;
};

export type FactoryContext = {
  seeds: SeedTitle[];
  /** TMDB ids of the movies the person has seen: «lo visto cuenta». */
  seenTmdbIds: Set<number>;
  platforms: Platform[];
  today: string;
};

export const loadFactoryContext = async (userId: string, now = new Date()): Promise<FactoryContext> => {
  const [rows, favoritas, user] = await Promise.all([
    db
      .select({ title: titles, film: catalog })
      .from(titles)
      .innerJoin(catalog, eq(titles.catalogId, catalog.id))
      .where(eq(titles.userId, userId)),
    db
      .select({ catalogId: listItems.catalogId })
      .from(listItems)
      .innerJoin(lists, eq(listItems.listId, lists.id))
      .where(and(eq(lists.userId, userId), eq(lists.slug, FAVORITAS_SLUG))),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { streamingPlatforms: true } }),
  ]);
  const favorite = new Set(favoritas.map((row) => row.catalogId));
  const all: SeedTitle[] = rows.map(({ title, film }) => ({
    catalogId: film.id,
    tmdbId: film.tmdbId,
    kind: film.kind,
    name: film.name,
    watched: title.watchedAt != null,
    rating: title.rating,
    favorite: favorite.has(film.id),
    createdAt: title.createdAt,
    people: parseThreadPeople(film.tmdbPeople),
    genreIds: parseStoredTmdbGenres(film.tmdbGenres).map((genre) => genre.id),
    posterPath: film.posterPath,
  }));
  return {
    seeds: rankSeeds(all),
    seenTmdbIds: new Set(all.filter((title) => title.watched && title.kind === "MOVIE").map((title) => title.tmdbId)),
    platforms: parseStoredStreamingPlatforms(user?.streamingPlatforms),
    today: todayIso(now),
  };
};

// ---------------------------------------------------------------------------
// Por colección
// ---------------------------------------------------------------------------

export const collectionDraftForSeed = async (seed: SeedTitle, ctx: FactoryContext): Promise<RutaDraft | null> => {
  const ref = await getTmdbMovieCollectionRef(seed.tmdbId);
  return ref ? collectionDraftById(ref.id, ctx, seed) : null;
};

const collectionDraftById = async (
  collectionId: number,
  ctx: FactoryContext,
  seed: SeedTitle | null,
  context?: string,
) => {
  const collection = await getTmdbCollection(collectionId);
  if (!collection) {
    return null;
  }
  // A collection the person already started from another film: that film is the seed.
  const seedInside =
    seed ??
    ctx.seeds.find((item) => collection.parts?.some((part) => part.id === item.tmdbId)) ??
    null;
  return collectionRutaDraft(collection, seedInside, ctx.seenTmdbIds, ctx.today, context);
};

// ---------------------------------------------------------------------------
// Por persona
// ---------------------------------------------------------------------------

const roleOfPerson = (person: ThreadPerson): PersonRutaRole => personRoleOfThread(person.role);

const onMyPlatforms = async (films: readonly RutaFilm[], ctx: FactoryContext) => {
  if (ctx.platforms.length === 0) {
    return new Set<number>();
  }
  const available = new Set<number>();
  await Promise.all(
    films.map(async (film) => {
      try {
        const providers = await fetchMxWatchProviders(film.tmdbId, "MOVIE");
        if (titleAvailableOnUserPlatforms(providers, ctx.platforms)) {
          available.add(film.tmdbId);
        }
      } catch {
        // Availability only nudges the order of the esenciales.
      }
    }),
  );
  return available;
};

/** One person's ruta in a role; `partner` makes it a duo's when their work is the same films. */
export const personDraft = async (
  personIds: readonly number[],
  role: PersonRutaRole,
  ctx: FactoryContext,
  seed: { tmdbId: number; name: string } | null,
): Promise<RutaDraft | null> => {
  const credits = await Promise.all(personIds.map((id) => getTmdbPersonCredits(id)));
  const filmsByPerson = credits.map((item) => personRoleFilms(item.credits, role, ctx.today));
  const duo = credits.length === 2 && isDuo(filmsByPerson[0]!, filmsByPerson[1]!);
  const ids = duo ? personIds : personIds.slice(0, 1);
  const films = filmsByPerson[0]!;
  const name = duo ? duoName(credits[0]!.person.name, credits[1]!.person.name) : credits[0]!.person.name;
  if (!name) {
    return null;
  }
  const candidates =
    films.length > PERSON_FULL_MAX
      ? [...films].filter((film) => !ctx.seenTmdbIds.has(film.tmdbId)).sort((a, b) => b.voteCount - a.voteCount).slice(0, 12)
      : [];
  const seedInside =
    seed ?? ctx.seeds.find((item) => item.watched && films.some((film) => film.tmdbId === item.tmdbId)) ?? null;
  return personRutaDraft({
    name,
    sourceKey: personSourceKey(ids, role),
    role,
    films,
    seed: seedInside ? { tmdbId: seedInside.tmdbId, name: seedInside.name } : null,
    seenTmdbIds: ctx.seenTmdbIds,
    onMyPlatforms: await onMyPlatforms(candidates, ctx),
    plural: duo,
  });
};

/** The people of a film worth a ruta, crew first: directors (a duo together), photography, music, top cast. */
const personCandidates = (seed: SeedTitle): Array<{ ids: number[]; role: PersonRutaRole }> => {
  const directors = seed.people.filter((person) => person.role === "director");
  const out: Array<{ ids: number[]; role: PersonRutaRole }> = [];
  if (directors.length === 2) {
    out.push({ ids: directors.map((person) => person.id), role: "director" });
  } else {
    out.push(...directors.slice(0, 1).map((person) => ({ ids: [person.id], role: "director" as const })));
  }
  for (const person of seed.people) {
    if (person.role === "dp" || person.role === "composer") {
      out.push({ ids: [person.id], role: roleOfPerson(person) });
    }
  }
  for (const person of seed.people.filter((item) => item.role === "cast").slice(0, 2)) {
    out.push({ ids: [person.id], role: "reparto" });
  }
  return out;
};

const ROLE_BONUS: Record<PersonRutaRole, number> = { director: 8, fotografia: 3, musica: 3, reparto: 0 };

/** A short, partly seen filmography beats a long one: it is an island you can close. Directors first. */
const personDraftScore = (draft: RutaDraft, ctx: FactoryContext) => {
  const seen = draft.steps.filter((step) => ctx.seenTmdbIds.has(step.film.tmdbId)).length;
  const whole = !draft.title.endsWith("esenciales");
  const parsed = parseSourceKey(draft.sourceKey);
  const bonus = parsed?.kind === "persona" ? ROLE_BONUS[parsed.role] : 0;
  return (whole ? 100 : 0) + seen * 10 - draft.steps.length + bonus;
};

const bestPersonDraft = async (
  seed: SeedTitle,
  ctx: FactoryContext,
  skip: ReadonlySet<string>,
  limit = 4,
): Promise<RutaDraft | null> => {
  const drafts: RutaDraft[] = [];
  for (const candidate of personCandidates(seed).slice(0, limit)) {
    if (skip.has(personSourceKey(candidate.ids, candidate.role))) {
      continue;
    }
    try {
      const draft = await personDraft(candidate.ids, candidate.role, ctx, seed);
      if (draft && !skip.has(draft.sourceKey)) {
        drafts.push(draft);
      }
    } catch {
      // One person TMDB cannot answer for does not stop the others.
    }
  }
  return drafts.sort((a, b) => personDraftScore(b, ctx) - personDraftScore(a, ctx))[0] ?? null;
};

// ---------------------------------------------------------------------------
// Day one, offers, rebuilding a source
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Desde un título
// ---------------------------------------------------------------------------

/**
 * «Si te gustó X» (FIL-I26-2): TMDB's recommendations for a film you saw, the unseen ones that
 * stream on your platforms (any platform when you have none set), in TMDB's order.
 */
export const titleDraftForSeed = async (seed: SeedTitle, ctx: FactoryContext): Promise<RutaDraft | null> => {
  const related = await getTmdbRelated(seed.tmdbId, "MOVIE", "recommendations");
  const pool = related
    .filter(
      (film) =>
        film.kind === "MOVIE" &&
        film.voteCount >= TITLE_RUTA_MIN_VOTES &&
        film.year != null &&
        film.year <= Number(ctx.today.slice(0, 4)) &&
        !ctx.seenTmdbIds.has(film.tmdbId),
    )
    .slice(0, 14)
    .map(
      (film): RutaFilm => ({
        tmdbId: film.tmdbId,
        name: film.name,
        originalName: film.originalName ?? null,
        year: film.year,
        releaseDate: null,
        posterPath: film.posterPath ?? null,
        backdropPath: film.backdropPath ?? null,
        overview: film.overview ?? null,
        voteAverage: film.voteAverage ?? 0,
        voteCount: film.voteCount,
        genreIds: film.genreIds,
      }),
    );
  const onMine = ctx.platforms.length > 0 ? await onMyPlatforms(pool, ctx) : null;
  const kept = onMine ? pool.filter((film) => onMine.has(film.tmdbId)) : pool;
  return titleRutaDraft(
    { tmdbId: seed.tmdbId, name: seed.name, genreIds: seed.genreIds },
    kept.slice(0, TITLE_RUTA_SIZE),
  );
};

// ---------------------------------------------------------------------------
// Day one, offers, rebuilding a source
// ---------------------------------------------------------------------------

/**
 * The first ruta from the best seed (favorita > best rated > first added): its collection when it
 * has one; else five films TMDB pairs with it on your platforms; else its closest person. The
 * first three seeds get a turn at the collection before anything else.
 */
export const dayOneDraft = async (ctx: FactoryContext): Promise<RutaDraft | null> => {
  for (const seed of ctx.seeds.slice(0, 3)) {
    const draft = await collectionDraftForSeed(seed, ctx).catch(() => null);
    if (draft) {
      return draft;
    }
  }
  for (const seed of ctx.seeds.slice(0, 2)) {
    const draft =
      (await titleDraftForSeed(seed, ctx).catch(() => null)) ?? (await bestPersonDraft(seed, ctx, new Set()));
    if (draft) {
      return draft;
    }
  }
  return null;
};

/**
 * Build the first ruta for a person who never had one (Hoy on day one, or the Bienvenida).
 * Null when they already had one, declined it, or nothing fits yet.
 */
export const ensureDayOneRuta = async (userId: string, via: RutaVia): Promise<CreatedRuta | null> => {
  if (!isTmdbConfigured() || (await rutasAlreadyOffered(userId))) {
    return null;
  }
  const ctx = await loadFactoryContext(userId);
  const draft = await dayOneDraft(ctx);
  if (!draft) {
    // Seen films and still nothing fits: stop trying on every visit (offers still work).
    if (ctx.seeds.length > 0) {
      await markRutasOffered(userId);
    }
    return null;
  }
  return createRuta(userId, draft, { via });
};

export type RutaOffer = {
  sourceKey: string;
  kind: RutaDraft["kind"];
  title: string;
  reason: string;
  total: number;
  /** Already seen: «llevas 1». */
  done: number;
  /** The first film to watch. */
  next: { name: string; year: number | null } | null;
};

const toOffer = (draft: RutaDraft, ctx: FactoryContext): RutaOffer => {
  const seen = draft.steps.filter((step) => ctx.seenTmdbIds.has(step.film.tmdbId));
  const next = draft.steps.find((step) => !ctx.seenTmdbIds.has(step.film.tmdbId));
  return {
    sourceKey: draft.sourceKey,
    kind: draft.kind,
    title: draft.title,
    reason: draft.reason,
    total: draft.steps.length,
    done: seen.length,
    next: next ? { name: next.film.name, year: next.film.year } : null,
  };
};

/**
 * What to offer next (the closing screen, «Rutas»): the saga TMDB pairs with the ruta just
 * finished (El Hobbit after the trilogy), the collections of your seeds, then the people of the
 * films the ruta and your seeds share. Never a source you already have.
 */
export const offerRutas = async (
  userId: string,
  options: { after?: RutaView | null; limit?: number; curated?: boolean } = {},
): Promise<RutaOffer[]> => {
  if (!isTmdbConfigured()) {
    return [];
  }
  // `curated`: the last slot is kept for the best fitting curated ruta, when one fits.
  const total = options.limit ?? 2;
  const [ctx, used] = await Promise.all([loadFactoryContext(userId), loadSourceKeys(userId)]);
  const curatedDraft = options.curated
    ? bestCuratedDraft(await loadCuratedLists(ctx.today), ctx.seeds, ctx.seenTmdbIds, used)
    : null;
  const limit = curatedDraft ? total - 1 : total;
  const offers: RutaOffer[] = [];
  const taken = new Set(used);
  const push = (draft: RutaDraft | null) => {
    if (draft && !taken.has(draft.sourceKey) && offers.length < limit) {
      taken.add(draft.sourceKey);
      offers.push(toOffer(draft, ctx));
    }
  };
  const safely = async <T>(run: () => Promise<T>) => {
    try {
      return await run();
    } catch {
      return null;
    }
  };

  const after = options.after ?? null;
  const lastFilm = after?.steps.at(-1)?.film;
  if (after && lastFilm) {
    push(await safely(() => sagaAfter(after, lastFilm.tmdbId, ctx, taken)));
  }

  for (const seed of ctx.seeds.slice(0, 5)) {
    if (offers.length >= limit) {
      break;
    }
    push(await safely(() => collectionDraftForSeed(seed, ctx)));
  }

  // People next: islands before bridges, so the films outside the ruta just finished come first,
  // and the closest island (short and partly seen) wins among them.
  const inRuta = new Set(after?.steps.map((step) => step.catalogId) ?? []);
  const outside = ctx.seeds.filter((seed) => !inRuta.has(seed.catalogId)).slice(0, 3);
  const inside = ctx.seeds.filter((seed) => inRuta.has(seed.catalogId)).slice(0, 1);
  // One person per film while there are films left: three people of the same trilogy is one island.
  const usedSeeds = new Set<string>();
  while (offers.length < limit) {
    const candidates = [...outside, ...inside];
    const fresh = candidates.filter((seed) => !usedSeeds.has(seed.catalogId));
    const drafts = (
      await Promise.all(
        (fresh.length > 0 ? fresh : candidates).map(async (seed) => {
          const draft = await safely(() => bestPersonDraft(seed, ctx, taken));
          return draft ? { seed, draft } : null;
        }),
      )
    ).filter((item): item is { seed: SeedTitle; draft: RutaDraft } => Boolean(item));
    const best = drafts.sort((a, b) => personDraftScore(b.draft, ctx) - personDraftScore(a.draft, ctx))[0];
    if (!best) {
      if (fresh.length > 0 && fresh.length < candidates.length) {
        fresh.forEach((seed) => usedSeeds.add(seed.catalogId));
        continue;
      }
      break;
    }
    usedSeeds.add(best.seed.catalogId);
    push(best.draft);
  }

  // Still room: what TMDB pairs with your seeds, on your platforms.
  for (const seed of outside) {
    if (offers.length >= limit) {
      break;
    }
    if (!taken.has(titleSourceKey(seed.tmdbId))) {
      push(await safely(() => titleDraftForSeed(seed, ctx)));
    }
  }
  if (curatedDraft && !taken.has(curatedDraft.sourceKey)) {
    offers.push(toOffer(curatedDraft, ctx));
  }
  return offers;
};

/**
 * The saga TMDB pairs with the ruta just finished, preferring one its director also made
 * (El Hobbit after the trilogy, not Narnia): the collections of its recommendations, checked
 * against the director's films.
 */
const sagaAfter = async (
  after: RutaView,
  lastTmdbId: number,
  ctx: FactoryContext,
  taken: ReadonlySet<string>,
): Promise<RutaDraft | null> => {
  const related = await getTmdbRelated(lastTmdbId, "MOVIE", "recommendations");
  const refs = (
    await Promise.all(related.slice(0, 8).map((film) => getTmdbMovieCollectionRef(film.tmdbId).catch(() => null)))
  ).filter((ref): ref is { id: number; name: string } => Boolean(ref) && !taken.has(`coleccion:${ref!.id}`));
  const unique = [...new Map(refs.map((ref) => [ref.id, ref])).values()];
  if (unique.length === 0) {
    return null;
  }
  const directorIds = [
    ...new Set(
      after.steps.flatMap((step) =>
        parseThreadPeople(step.film.tmdbPeople)
          .filter((person) => person.role === "director")
          .map((person) => person.id),
      ),
    ),
  ].slice(0, 2);
  const directed = new Set<number>();
  for (const id of directorIds) {
    const credits = await getTmdbPersonCredits(id).catch(() => null);
    for (const film of credits ? personRoleFilms(credits.credits, "director", ctx.today) : []) {
      directed.add(film.tmdbId);
    }
  }
  const context = `Después de ${after.shortTitle}.`;
  const drafts = (
    await Promise.all(unique.map((ref) => collectionDraftById(ref.id, ctx, null, context).catch(() => null)))
  ).filter((draft): draft is RutaDraft => Boolean(draft));
  const sameDirector = drafts.find((draft) => draft.steps.some((step) => directed.has(step.film.tmdbId)));
  return sameDirector ?? drafts[0] ?? null;
};

/** The ruta behind an offer, rebuilt from its source (the same cached TMDB answers). */
export const draftFromSourceKey = async (userId: string, sourceKey: string): Promise<RutaDraft | null> => {
  const parsed = parseSourceKey(sourceKey);
  if (!parsed || !isTmdbConfigured()) {
    return null;
  }
  const ctx = await loadFactoryContext(userId);
  if (parsed.kind === "coleccion") {
    return collectionDraftById(parsed.collectionId, ctx, null);
  }
  if (parsed.kind === "titulo") {
    const seed = ctx.seeds.find((item) => item.tmdbId === parsed.seedTmdbId);
    return seed ? titleDraftForSeed(seed, ctx) : null;
  }
  if (parsed.kind === "curada") {
    const [list] = await loadCuratedLists(ctx.today, [parsed.listId]);
    if (!list) {
      return null;
    }
    const follows = ctx.seeds.find((seed) => seed.watched && list.curatedFor.includes(seed.tmdbId)) ?? null;
    return curatedRutaDraft(list, ctx.seenTmdbIds, follows);
  }
  if (parsed.kind === "temporada") {
    return seasonDraft(parsed.catalogId, parsed.personIds, parsed.role, ctx);
  }
  const draft = await personDraft(parsed.personIds, parsed.role, ctx, null);
  return draft && draft.sourceKey === sourceKey ? draft : null;
};

export const seasonSourceKey = (catalogId: string, personIds: readonly number[], role: PersonRutaRole) =>
  `temporada:${catalogId}:${[...personIds].sort((a, b) => a - b).join("+")}:${role}`;

/**
 * «Ruta: antes de verla» (P3): the person behind an upcoming premiere, as a ruta that ends the
 * day the film opens (archived in silence if it is not finished by then).
 */
export const seasonDraft = async (
  catalogId: string,
  personIds: readonly number[],
  role: PersonRutaRole,
  ctx: FactoryContext,
): Promise<RutaDraft | null> => {
  const [release] = await db
    .select({ name: catalog.name, day: cinemaReleases.mxReleaseDate })
    .from(cinemaReleases)
    .innerJoin(catalog, eq(cinemaReleases.catalogId, catalog.id))
    .where(eq(cinemaReleases.catalogId, catalogId))
    .limit(1);
  if (!release || release.day < ctx.today) {
    return null;
  }
  const draft = await personDraft(personIds, role, ctx, null);
  if (!draft) {
    return null;
  }
  return {
    ...draft,
    kind: "temporada",
    title: `Antes de ${release.name}: ${draft.shortTitle}`,
    shortTitle: `Antes de ${release.name}`,
    reason: `${release.name} llega a cines el ${formatShortDay(release.day)}. ${draft.reason}`,
    sourceKey: seasonSourceKey(catalogId, personIds, role),
    endsOn: release.day,
  };
};

/** Start the ruta of an offer; null when the source no longer makes a ruta. */
export const startRutaFromSource = async (userId: string, sourceKey: string, via: RutaVia) => {
  const draft = await draftFromSourceKey(userId, sourceKey);
  return draft ? createRuta(userId, draft, { via }) : null;
};

/** A step of the first ruta as the Bienvenida shows it (R6): three posters, the next one lit. */
export type FirstRutaStep = { name: string; posterPath: string | null; seen: boolean };

export type FirstRutaOffer = RutaOffer & {
  seed: { name: string; favorite: boolean } | null;
  steps: FirstRutaStep[];
  /** The why of the step to watch. */
  nextWhy: string | null;
};

export type FirstRutas = {
  main: FirstRutaOffer | null;
  /** «O empieza por otra»: up to two, each with what you already carry («llevas 1»). */
  alternatives: RutaOffer[];
};

/**
 * The Bienvenida's last step (FIL-I26-2): the first ruta (as `dayOneDraft` would build it) and two
 * others, a person's whole filmography first, then «Si te gustó» another seed. Builds nothing.
 */
export const firstRutas = async (userId: string): Promise<FirstRutas> => {
  if (!isTmdbConfigured()) {
    return { main: null, alternatives: [] };
  }
  const ctx = await loadFactoryContext(userId);
  const main = await dayOneDraft(ctx);
  const taken = new Set(main ? [main.sourceKey] : []);
  const mainFilms = new Set(main?.steps.map((step) => step.film.tmdbId) ?? []);
  const alternatives: RutaOffer[] = [];
  const push = (draft: RutaDraft | null) => {
    if (draft && !taken.has(draft.sourceKey) && alternatives.length < 2) {
      taken.add(draft.sourceKey);
      alternatives.push(toOffer(draft, ctx));
    }
  };

  // The closest island among the seeds (a short filmography you started), one per seed.
  const persons = (
    await Promise.all(ctx.seeds.slice(0, 3).map((seed) => bestPersonDraft(seed, ctx, taken).catch(() => null)))
  ).filter((draft): draft is RutaDraft => Boolean(draft) && !draft!.steps.every((step) => mainFilms.has(step.film.tmdbId)));
  push(persons.sort((a, b) => personDraftScore(b, ctx) - personDraftScore(a, ctx))[0] ?? null);

  const mainSeed = main?.seedTmdbId ?? null;
  for (const seed of ctx.seeds.slice(0, 3)) {
    if (alternatives.length >= 2) {
      break;
    }
    if (seed.tmdbId !== mainSeed) {
      push(await titleDraftForSeed(seed, ctx).catch(() => null));
    }
  }
  for (const draft of persons) {
    push(draft);
  }
  // Curated last (colección > persona > título > curada), only when it fits a seed.
  push(bestCuratedDraft(await loadCuratedLists(ctx.today).catch(() => []), ctx.seeds, ctx.seenTmdbIds, taken));

  if (!main) {
    return { main: null, alternatives };
  }
  const seed = ctx.seeds.find((item) => item.tmdbId === main.seedTmdbId) ?? null;
  const nextIndex = main.steps.findIndex((step) => !ctx.seenTmdbIds.has(step.film.tmdbId));
  // Three posters around the next one: the last seen, the next, the one after it (face down).
  const from = Math.max(0, nextIndex - 1);
  return {
    main: {
      ...toOffer(main, ctx),
      seed: seed ? { name: seed.name, favorite: seed.favorite } : null,
      steps: main.steps.slice(from, from + 3).map((step) => ({
        name: step.film.name,
        posterPath: step.film.posterPath,
        seen: ctx.seenTmdbIds.has(step.film.tmdbId),
      })),
      nextWhy: nextIndex >= 0 ? (main.steps[nextIndex]?.why ?? null) : null,
    },
    alternatives,
  };
};
