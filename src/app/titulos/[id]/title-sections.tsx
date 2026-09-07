import { TitleActionRow } from "@/components/TitleActionRow";
import { TitleHero } from "@/components/TitleHero";
import { TitleListsPanel } from "@/components/TitleListsPanel";
import { TitlePosterRail } from "@/components/TitlePosterRail";
import { TitleSaveCta } from "@/components/TitleSaveCta";
import { TitleSynopsis } from "@/components/TitleSynopsis";
import { TitleTagsPanel } from "@/components/TitleTagsPanel";
import { WatchProvidersMx } from "@/components/WatchProvidersMx";
import { TitleKind } from "@/db";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { formatRuntime, TITLE_KIND_LABEL } from "@/lib/labels";
import type { FilterTag } from "@/lib/queries";
import { tmdbBackdropUrl, type TmdbTitleExtras } from "@/lib/tmdb";
import type { WatchProvidersResult } from "@/lib/watch-providers-cache";
import type { getAssignableLists, getRelatedTitles, getTitleById, getUserStreamingPlatforms } from "@/lib/queries";

type TitleDetail = NonNullable<Awaited<ReturnType<typeof getTitleById>>>;
type AssignableLists = Awaited<ReturnType<typeof getAssignableLists>>;
type UserPlatforms = Awaited<ReturnType<typeof getUserStreamingPlatforms>>;
type RelatedTitles = Awaited<ReturnType<typeof getRelatedTitles>>;

const posterBackdrop = (posterPath: string | null | undefined) =>
  posterPath ? `https://image.tmdb.org/t/p/w780${posterPath}` : null;

const titleMembership = (title: TitleDetail) => {
  const memberLists = title.listItems?.map((item) => item.list) ?? [];
  return {
    memberLists,
    memberListIds: title.listItems?.map((item) => item.listId) ?? [],
    inWatchlist: memberLists.some((list) => list.slug === WATCHLIST_SLUG),
    inCustomList: memberLists.some((list) => list.slug !== WATCHLIST_SLUG),
  };
};

export const TitleHeroFallback = ({
  title,
  extras,
}: {
  title: TitleDetail;
  extras?: TmdbTitleExtras | null;
}) => (
  <TitleHero
    titleId={title.id}
    name={title.name}
    originalName={title.originalName}
    posterPath={title.posterPath ?? extras?.posterPath}
    backdropSrc={
      extras?.backdropPath
        ? tmdbBackdropUrl(extras.backdropPath, "w1280")
        : posterBackdrop(title.posterPath ?? extras?.posterPath)
    }
    year={title.year}
    runtimeLabel={formatRuntime(title.runtimeMinutes ?? extras?.runtimeMinutes)}
    kindLabel={TITLE_KIND_LABEL[title.kind]}
    imdbRating={title.imdbRating}
    rating={title.rating}
    watched={Boolean(title.watchedAt)}
  />
);

export const TitleHeroBlock = async ({
  title,
  extrasPromise,
}: {
  title: TitleDetail;
  extrasPromise: Promise<TmdbTitleExtras | null>;
}) => {
  const extras = await extrasPromise;
  const posterPath = title.posterPath ?? extras?.posterPath ?? null;
  const backdropSrc = extras?.backdropPath
    ? tmdbBackdropUrl(extras.backdropPath, "w1280")
    : posterBackdrop(posterPath);

  return (
    <TitleHero
      titleId={title.id}
      name={title.name}
      originalName={title.originalName}
      posterPath={posterPath}
      backdropSrc={backdropSrc}
      year={title.year}
      runtimeLabel={formatRuntime(title.runtimeMinutes ?? extras?.runtimeMinutes)}
      kindLabel={TITLE_KIND_LABEL[title.kind]}
      imdbRating={title.imdbRating}
      rating={title.rating}
      watched={Boolean(title.watchedAt)}
    />
  );
};

export const TitleActionsBlock = async ({
  title,
  listsPromise,
  tagsPromise,
}: {
  title: TitleDetail;
  listsPromise: Promise<AssignableLists>;
  tagsPromise: Promise<FilterTag[]>;
}) => {
  const [assignableLists, tags] = await Promise.all([listsPromise, tagsPromise]);
  const { memberLists, memberListIds, inWatchlist, inCustomList } = titleMembership(title);
  const listsPanel = (
    <TitleListsPanel
      titleId={title.id}
      lists={assignableLists}
      memberListIds={memberListIds}
    />
  );

  return (
    <>
      <TitleSaveCta
        titleId={title.id}
        inWatchlist={inWatchlist}
        memberLists={memberLists}
        listsPanel={listsPanel}
      />
      <TitleActionRow
        titleId={title.id}
        watched={Boolean(title.watchedAt)}
        inWatchlist={inWatchlist}
        inCustomList={inCustomList}
        rating={title.rating}
        review={title.review}
        listsPanel={listsPanel}
        tagsPanel={
          <TitleTagsPanel
            titleId={title.id}
            tags={tags}
            selectedTagIds={title.tags.map((item) => item.tagId)}
          />
        }
      />
    </>
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
    />
  );
};

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
  return extras?.overview ? <TitleSynopsis text={extras.overview} /> : null;
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
