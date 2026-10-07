import type { ReactNode } from "react";
import { TitleFichaActions } from "@/components/TitleFichaActions";
import { TitleHero } from "@/components/TitleHero";
import { TitleListsPanel } from "@/components/TitleListsPanel";
import { TitlePosterRail } from "@/components/TitlePosterRail";
import { TitleSynopsis } from "@/components/TitleSynopsis";
import { WatchProvidersMx } from "@/components/WatchProvidersMx";
import { TitleKind } from "@/db";
import { titleListMemberships } from "@/lib/list-membership";
import { formatRuntime, TITLE_KIND_LABEL } from "@/lib/labels";
import { parseStoredPeople } from "@/lib/tonight-store";
import { formatCredits } from "@/lib/watchlist-credits";
import { isTmdbConfigured, tmdbBackdropUrl, type TmdbTitleExtras } from "@/lib/tmdb";
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
    memberLists,
    memberListIds: title.listItems?.map((item) => item.listId) ?? [],
    inWatchlist: memberships.inWatchlist,
    listCount: memberships.lists.length,
  };
};

/** «Dirigida por … · Con …» (or «Creada por …» for series) from the enriched people; null when empty. */
export const titleCredits = (title: Pick<TitleDetail, "tmdbPeople" | "kind">) =>
  formatCredits(parseStoredPeople(title.tmdbPeople), title.kind);

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
}: {
  title: TitleDetail;
  listsPromise: Promise<AssignableLists>;
}) => {
  const assignableLists = await listsPromise;
  const { memberLists, memberListIds, inWatchlist, listCount } = titleMembership(title);
  const listsPanel = (
    <TitleListsPanel
      titleId={title.id}
      lists={assignableLists}
      memberListIds={memberListIds}
    />
  );

  return (
    <TitleFichaActions
      titleId={title.id}
      titleName={title.name}
      watched={Boolean(title.watchedAt)}
      inWatchlist={inWatchlist}
      memberLists={memberLists}
      listCount={listCount}
      rating={title.rating}
      review={title.review ?? null}
      listsPanel={listsPanel}
    />
  );
};

/** Ficha credits; renders nothing when TMDB people are missing or unusable. */
export const TitleCredits = ({ credits }: { credits: string | null }) => {
  if (!credits) {
    return null;
  }

  return (
    <section className="space-y-2" aria-label="Créditos">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-mist">
        Créditos
      </h2>
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

export const TitleSynopsisBlock = async ({
  storedOverview,
  extrasPromise,
  credits = null,
}: {
  storedOverview: string | null;
  extrasPromise: Promise<TmdbTitleExtras | null>;
  credits?: string | null;
}) => {
  const stored = storedOverview?.trim() || null;
  if (stored) {
    return (
      <SynopsisWithCredits credits={credits}>
        <TitleSynopsis text={stored} />
      </SynopsisWithCredits>
    );
  }

  const extras = await extrasPromise;
  return (
    <SynopsisWithCredits credits={credits}>
      <TitleSynopsis text={extras?.overview ?? null} />
    </SynopsisWithCredits>
  );
};

/** Credits ride with the synopsis so they stream in together (no shift under a late overview). */
const SynopsisWithCredits = ({
  credits,
  children,
}: {
  credits: string | null;
  children: ReactNode;
}) =>
  credits ? (
    <div className="space-y-6">
      {children}
      <TitleCredits credits={credits} />
    </div>
  ) : (
    children
  );

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
