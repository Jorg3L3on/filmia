import { Suspense, type ReactNode } from "react";
import { AffinityChipSkeleton } from "@/components/affinity/AffinityChip";
import { FichaAffinityBlock } from "@/components/affinity/FichaAffinityBlock";
import { PeopleRail } from "@/components/ficha/PeopleRail";
import { TrailerButton } from "@/components/ficha/TrailerButton";
import { TitleFichaActions } from "@/components/TitleFichaActions";
import { TitleHero } from "@/components/TitleHero";
import { TitleListsPanel } from "@/components/TitleListsPanel";
import { TitlePosterRail } from "@/components/TitlePosterRail";
import { TitleSynopsis } from "@/components/TitleSynopsis";
import { WatchProvidersMx } from "@/components/WatchProvidersMx";
import { CinemaBadge } from "@/components/cine/CinemaBadge";
import { TitleKind } from "@/db";
import { awardChipLabel } from "@/lib/awards";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { titleListMemberships } from "@/lib/list-membership";
import { formatRuntime, imdbTitleUrl, TITLE_KIND_LABEL } from "@/lib/labels";
import { getTmdbTrailer, isTmdbConfigured, tmdbBackdropUrl, type TmdbTitleExtras } from "@/lib/tmdb";
import type { AffinityCatalogRow, FichaAffinity } from "@/lib/affinity-store";
import type { DiaryLog } from "@/lib/title-preview";
import { peopleRailItems, type TmdbPerson } from "@/lib/tmdb-people";
import type { WatchProvidersResult } from "@/lib/watch-providers-cache";
import type { getCinemaRelease } from "@/lib/cine";
import type { getAssignableLists, getRelatedTitles, getTitleById, getUserStreamingPlatforms } from "@/lib/queries";

type TitleDetail = NonNullable<Awaited<ReturnType<typeof getTitleById>>>;
type CinemaRelease = Awaited<ReturnType<typeof getCinemaRelease>>;
type AssignableLists = Awaited<ReturnType<typeof getAssignableLists>>;
type UserPlatforms = Awaited<ReturnType<typeof getUserStreamingPlatforms>>;
type RelatedTitles = Awaited<ReturnType<typeof getRelatedTitles>>;

const posterBackdrop = (posterPath: string | null | undefined) =>
  posterPath ? `https://image.tmdb.org/t/p/w780${posterPath}` : null;

const titleMembership = (title: TitleDetail) => {
  const memberLists =
    title.listItems?.map(({ list }) => ({ id: list.id, name: list.name, slug: list.slug })) ?? [];
  const memberships = titleListMemberships(memberLists);
  return {
    memberListIds: title.listItems?.map((item) => item.listId) ?? [],
    inWatchlist: memberships.inWatchlist,
    listCount: memberships.lists.length,
  };
};

/** What the hero reads: a user's Title or a ficha preview's catalog row (FIL-I8). */
export type HeroSource = Pick<
  TitleDetail,
  | "id"
  | "name"
  | "originalName"
  | "posterPath"
  | "backdropPath"
  | "year"
  | "runtimeMinutes"
  | "kind"
  | "tmdbGenres"
  | "imdbRating"
  | "imdbId"
  | "awards"
  | "rating"
  | "watchedAt"
  | "posterAmbient"
>;

export const heroProps = (
  title: HeroSource,
  extras: TmdbTitleExtras | null | undefined,
  options: {
    posterKey?: string;
    imdbPending?: boolean;
    affinity?: ReactNode;
    trailer?: ReactNode;
  } = {},
) => {
  const posterPath = title.posterPath ?? extras?.posterPath ?? null;
  return {
    titleId: options.posterKey ?? title.id,
    name: title.name,
    originalName: title.originalName,
    posterPath,
    backdropSrc: extras?.backdropPath
      ? tmdbBackdropUrl(extras.backdropPath, "w1280")
      : title.backdropPath
        ? tmdbBackdropUrl(title.backdropPath, "w1280")
        : posterBackdrop(posterPath),
    year: title.year,
    runtimeLabel: formatRuntime(title.runtimeMinutes ?? extras?.runtimeMinutes),
    kindLabel: TITLE_KIND_LABEL[title.kind],
    genreLabel: parseStoredTmdbGenres(title.tmdbGenres)[0]?.name ?? extras?.genres[0]?.name ?? null,
    imdbRating: title.imdbRating,
    imdbHref: imdbTitleUrl(title.imdbId),
    imdbPending: options.imdbPending ?? false,
    awardLabel: awardChipLabel(title.awards),
    rating: title.rating,
    watched: Boolean(title.watchedAt),
    posterAmbient: title.posterAmbient,
    affinity: options.affinity,
    trailer: options.trailer,
  };
};

export const TitleHeroFallback = ({
  title,
  extras,
  affinity,
  trailer,
}: {
  title: TitleDetail;
  extras?: TmdbTitleExtras | null;
  affinity?: ReactNode;
  trailer?: ReactNode;
}) => <TitleHero {...heroProps(title, extras, { affinity, trailer })} />;

export const TitleHeroBlock = async ({
  title,
  extrasPromise,
  affinity,
  trailer,
}: {
  title: TitleDetail;
  extrasPromise: Promise<TmdbTitleExtras | null>;
  affinity?: ReactNode;
  trailer?: ReactNode;
}) => <TitleHero {...heroProps(title, await extrasPromise, { affinity, trailer })} />;

/** «▶ Tráiler» (FIL-I15-2), streamed on its own so the hero never waits for TMDB /videos. */
export const TrailerSlot = ({
  tmdbId,
  kind,
  titleName,
  backdropPath,
  extrasPromise,
}: {
  tmdbId: number | null;
  kind: TitleDetail["kind"];
  titleName: string;
  backdropPath: string | null;
  extrasPromise: Promise<TmdbTitleExtras | null>;
}) =>
  tmdbId ? (
    <Suspense fallback={null}>
      <TrailerBlock
        tmdbId={tmdbId}
        kind={kind}
        titleName={titleName}
        backdropPath={backdropPath}
        extrasPromise={extrasPromise}
      />
    </Suspense>
  ) : null;

const TrailerBlock = async ({
  tmdbId,
  kind,
  titleName,
  backdropPath,
  extrasPromise,
}: {
  tmdbId: number;
  kind: TitleDetail["kind"];
  titleName: string;
  backdropPath: string | null;
  extrasPromise: Promise<TmdbTitleExtras | null>;
}) => {
  const trailer = await getTmdbTrailer(tmdbId, kind);
  if (!trailer) {
    return null;
  }
  const backdrop = backdropPath ?? (await extrasPromise)?.backdropPath ?? null;
  return (
    <TrailerButton
      trailerKey={trailer.key}
      titleName={titleName}
      backdropSrc={backdrop ? tmdbBackdropUrl(backdrop, "w1280") : null}
    />
  );
};

/** The Catalog fields «Para ti» reads, from a flat ficha title (owned or preview). */
export const affinityRowOf = (title: {
  catalogId: string;
  tmdbId: number;
  kind: TitleDetail["kind"];
  name: string;
  year: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  tmdbGenres: unknown;
  tmdbKeywords: unknown;
  tmdbPeople: unknown;
  originalLanguage: string | null;
}): AffinityCatalogRow => ({
  id: title.catalogId,
  tmdbId: title.tmdbId,
  kind: title.kind,
  name: title.name,
  year: title.year,
  imdbRating: title.imdbRating,
  imdbVotes: title.imdbVotes,
  tmdbGenres: title.tmdbGenres,
  tmdbKeywords: title.tmdbKeywords,
  tmdbPeople: title.tmdbPeople,
  originalLanguage: title.originalLanguage,
});

/** The chip, streamed in its own boundary so the hero never waits for the profile. */
export const AffinitySlot = ({
  promise,
  titleName,
}: {
  promise: Promise<FichaAffinity | null>;
  titleName: string;
}) => (
  <Suspense fallback={<AffinityChipSkeleton />}>
    <FichaAffinityBlock promise={promise} titleName={titleName} />
  </Suspense>
);

export const TitleActionsBlock = async ({
  title,
  listsPromise,
  pinnedPromise,
  diaryLog = null,
}: {
  title: TitleDetail;
  listsPromise: Promise<AssignableLists>;
  pinnedPromise: Promise<string | null>;
  diaryLog?: DiaryLog | null;
}) => {
  const [assignableLists, pinnedTitleId] = await Promise.all([listsPromise, pinnedPromise]);
  const { memberListIds, inWatchlist, listCount } = titleMembership(title);

  return (
    <TitleFichaActions
      titleId={title.id}
      diaryLog={diaryLog}
      titleName={title.name}
      watched={Boolean(title.watchedAt)}
      inWatchlist={inWatchlist}
      listCount={listCount}
      rating={title.rating}
      review={title.review ?? null}
      platform={title.platform ?? null}
      pinnedTonight={pinnedTitleId === title.id}
      listsPanel={
        <TitleListsPanel titleId={title.id} lists={assignableLists} memberListIds={memberListIds} />
      }
    />
  );
};

/** Under the title (dirección A): the stored overview first, TMDB's when the row has none. */
export const TitleSynopsisBlock = async ({
  storedOverview,
  extrasPromise,
}: {
  storedOverview: string | null;
  extrasPromise: Promise<TmdbTitleExtras | null>;
}) => {
  const stored = storedOverview?.trim() || null;
  if (stored) {
    return <TitleSynopsis text={stored} />;
  }
  const extras = await extrasPromise;
  return <TitleSynopsis text={extras?.overview ?? null} />;
};

/** Dirección · Fotografía · reparto with photos (FIL-I4-5); nothing when TMDB has no usable names. */
export const TitlePeopleBlock = async ({
  peoplePromise,
  kind,
}: {
  peoplePromise: Promise<TmdbPerson[]>;
  kind: TitleDetail["kind"];
}) => <PeopleRail items={peopleRailItems(await peoplePromise, kind)} />;

export const TitleProvidersBlock = async ({
  providersPromise,
  platformsPromise,
  cinemaPromise,
}: {
  providersPromise: Promise<WatchProvidersResult>;
  platformsPromise: Promise<UserPlatforms>;
  /** Cine (FIL-I17-4): the film's MX theatrical release, when it has one. */
  cinemaPromise?: Promise<CinemaRelease>;
}) => {
  const [watchProvidersResult, userPlatforms, cinema] = await Promise.all([
    providersPromise,
    platformsPromise,
    cinemaPromise ?? null,
  ]);
  // Once it streams in MX the theaters are old news.
  const showCinema = cinema && !(watchProvidersResult.data?.flatrate.length);

  const providers = (
    <WatchProvidersMx
      data={watchProvidersResult.data}
      userPlatforms={userPlatforms}
      tmdbConfigured={isTmdbConfigured()}
      stale={watchProvidersResult.stale}
    />
  );
  if (!showCinema) {
    return providers;
  }
  return (
    <div className="space-y-3">
      <CinemaBadge release={cinema} />
      {providers}
    </div>
  );
};

export const TitleRelatedBlock = async ({
  relatedPromise,
}: {
  relatedPromise: Promise<RelatedTitles>;
}) => {
  const related = await relatedPromise;
  if (related.length === 0) {
    return null;
  }

  return (
    <TitlePosterRail
      title="Relacionadas"
      ariaLabel="Títulos relacionados"
      titles={related}
    />
  );
};

export const isSeriesTitle = (title: TitleDetail) => title.kind === TitleKind.SERIES;
