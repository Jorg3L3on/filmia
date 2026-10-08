import { TitleFichaActions } from "@/components/TitleFichaActions";
import { TitleHero } from "@/components/TitleHero";
import { TitleListsPanel } from "@/components/TitleListsPanel";
import { TitlePosterRail } from "@/components/TitlePosterRail";
import { TitleSynopsis } from "@/components/TitleSynopsis";
import { WatchProvidersMx } from "@/components/WatchProvidersMx";
import { TitleKind } from "@/db";
import { awardChipLabel } from "@/lib/awards";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { titleListMemberships } from "@/lib/list-membership";
import { formatRuntime, TITLE_KIND_LABEL } from "@/lib/labels";
import { parseStoredPeople } from "@/lib/tonight-store";
import { formatCredits } from "@/lib/watchlist-credits";
import { isTmdbConfigured, tmdbBackdropUrl, type TmdbTitleExtras } from "@/lib/tmdb";
import type { TmdbPerson } from "@/lib/tmdb-people";
import type { WatchProvidersResult } from "@/lib/watch-providers-cache";
import type { getAssignableLists, getRelatedTitles, getTitleById, getUserStreamingPlatforms } from "@/lib/queries";

type TitleDetail = NonNullable<Awaited<ReturnType<typeof getTitleById>>>;
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

const heroProps = (title: TitleDetail, extras: TmdbTitleExtras | null | undefined) => {
  const posterPath = title.posterPath ?? extras?.posterPath ?? null;
  return {
    titleId: title.id,
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
    awardLabel: awardChipLabel(title.awards),
    rating: title.rating,
    watched: Boolean(title.watchedAt),
    posterAmbient: title.posterAmbient,
  };
};

export const TitleHeroFallback = ({
  title,
  extras,
}: {
  title: TitleDetail;
  extras?: TmdbTitleExtras | null;
}) => <TitleHero {...heroProps(title, extras)} />;

export const TitleHeroBlock = async ({
  title,
  extrasPromise,
}: {
  title: TitleDetail;
  extrasPromise: Promise<TmdbTitleExtras | null>;
}) => <TitleHero {...heroProps(title, await extrasPromise)} />;

export const TitleActionsBlock = async ({
  title,
  listsPromise,
  pinnedPromise,
}: {
  title: TitleDetail;
  listsPromise: Promise<AssignableLists>;
  pinnedPromise: Promise<string | null>;
}) => {
  const [assignableLists, pinnedTitleId] = await Promise.all([listsPromise, pinnedPromise]);
  const { memberListIds, inWatchlist, listCount } = titleMembership(title);

  return (
    <TitleFichaActions
      titleId={title.id}
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

/** «Dirigida por … · Con …» until the people rail (FIL-I4-5); nothing when TMDB has no usable names. */
export const TitleCreditsBlock = async ({
  peoplePromise,
  kind,
}: {
  peoplePromise: Promise<TmdbPerson[]>;
  kind: TitleDetail["kind"];
}) => {
  const credits = formatCredits(parseStoredPeople(await peoplePromise), kind);
  if (!credits) {
    return null;
  }
  return (
    <section className="space-y-2" aria-label="Créditos">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-mist">Créditos</h2>
      <p className="max-w-2xl text-sm leading-7 text-fog">{credits}</p>
    </section>
  );
};

export const TitleProvidersBlock = async ({
  providersPromise,
  platformsPromise,
}: {
  providersPromise: Promise<WatchProvidersResult>;
  platformsPromise: Promise<UserPlatforms>;
}) => {
  const [watchProvidersResult, userPlatforms] = await Promise.all([
    providersPromise,
    platformsPromise,
  ]);

  return (
    <WatchProvidersMx
      data={watchProvidersResult.data}
      userPlatforms={userPlatforms}
      tmdbConfigured={isTmdbConfigured()}
      stale={watchProvidersResult.stale}
    />
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
