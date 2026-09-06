import Link from "next/link";
import { notFound } from "next/navigation";
import { TitleKind } from "@/db";
import { deleteTitle } from "@/app/actions/titles";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { SeriesStatusPanel } from "@/components/SeriesStatusPanel";
import { TitleActionRow } from "@/components/TitleActionRow";
import { TitleHero } from "@/components/TitleHero";
import { TitleListsPanel } from "@/components/TitleListsPanel";
import { TitleSaveCta } from "@/components/TitleSaveCta";
import { TitlePosterRail } from "@/components/TitlePosterRail";
import { TitleTagsPanel } from "@/components/TitleTagsPanel";
import { TitleSynopsis } from "@/components/TitleSynopsis";
import { WatchedBadge } from "@/components/WatchedBadge";
import { WatchProvidersMx } from "@/components/WatchProvidersMx";
import { WATCHLIST_SLUG } from "@/lib/lists";
import { formatWatchedDate } from "@/lib/dates";
import { formatRuntime, TITLE_KIND_LABEL } from "@/lib/labels";
import {
  getAssignableLists,
  getRelatedTitles,
  getTags,
  getTitleById,
  getUserStreamingPlatforms,
} from "@/lib/queries";
import { btnDanger, btnGhost, wellClass } from "@/lib/ui";
import { getTmdbTitleExtras, tmdbBackdropUrl } from "@/lib/tmdb";
import { getWatchProvidersForTitle } from "@/lib/watch-providers-cache";

export const dynamic = "force-dynamic";

export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [title, assignableLists, userPlatforms, tags] = await Promise.all([
    getTitleById(id),
    getAssignableLists(),
    getUserStreamingPlatforms(),
    getTags(),
  ]);

  if (!title) {
    notFound();
  }

  const [watchProvidersResult, extras, related] = await Promise.all([
    getWatchProvidersForTitle(title),
    title.tmdbId
      ? getTmdbTitleExtras(title.tmdbId, title.kind)
      : Promise.resolve(null),
    getRelatedTitles(
      title.id,
      title.tags.map((item) => item.tagId),
    ),
  ]);

  const watchProviders = watchProvidersResult.data;
  const deleteAction = deleteTitle.bind(null, title.id);
  const inWatchlist = title.listItems.some(
    (item) => item.list.slug === WATCHLIST_SLUG,
  );
  const memberLists = title.listItems.map((item) => item.list);
  const inCustomList = memberLists.some((list) => list.slug !== WATCHLIST_SLUG);
  const backdropSrc = extras?.backdropPath
    ? tmdbBackdropUrl(extras.backdropPath, "w1280")
    : title.posterPath
      ? `https://image.tmdb.org/t/p/w780${title.posterPath}`
      : null;
  const runtimeLabel = formatRuntime(extras?.runtimeMinutes);

  return (
    <article className="space-y-8">
      <TitleHero
        titleId={title.id}
        name={title.name}
        originalName={title.originalName}
        posterPath={title.posterPath}
        backdropSrc={backdropSrc}
        year={title.year}
        runtimeLabel={runtimeLabel}
        kindLabel={TITLE_KIND_LABEL[title.kind]}
        imdbRating={title.imdbRating}
        rating={title.rating}
        watched={Boolean(title.watchedAt)}
      />

      <TitleSaveCta
        titleId={title.id}
        inWatchlist={inWatchlist}
        memberLists={memberLists}
        listsPanel={
          <TitleListsPanel
            titleId={title.id}
            lists={assignableLists}
            memberListIds={title.listItems.map((item) => item.listId)}
          />
        }
      />

      <TitleActionRow
        titleId={title.id}
        watched={Boolean(title.watchedAt)}
        inWatchlist={inWatchlist}
        inCustomList={inCustomList}
        rating={title.rating}
        review={title.review}
        listsPanel={
          <TitleListsPanel
            titleId={title.id}
            lists={assignableLists}
            memberListIds={title.listItems.map((item) => item.listId)}
          />
        }
        tagsPanel={
          <TitleTagsPanel
            titleId={title.id}
            tags={tags}
            selectedTagIds={title.tags.map((item) => item.tagId)}
          />
        }
      />

      <WatchProvidersMx data={watchProviders} userPlatforms={userPlatforms} />

      {extras?.overview ? <TitleSynopsis text={extras.overview} /> : null}

      {title.kind === TitleKind.SERIES ? (
        <SeriesStatusPanel
          titleId={title.id}
          seriesStatus={title.seriesStatus}
          seriesSeason={title.seriesSeason}
        />
      ) : null}

      {title.watchedAt ? (
        <section className={`${wellClass} space-y-4 p-5`}>
          <header className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-success">
              Mi registro
            </p>
            <h2 className="font-serif text-xl text-paper">{title.name}</h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-fog">
              <WatchedBadge />
              Vista el {formatWatchedDate(title.watchedAt)}
            </p>
          </header>
          <MarkWatchedForm
            titleId={title.id}
            variant="detail"
            watchedAt={title.watchedAt}
            rating={title.rating}
            review={title.review}
          />
        </section>
      ) : null}

      {related.length > 0 ? (
        <TitlePosterRail
          title="Relacionadas"
          ariaLabel="Títulos relacionados"
          titles={related}
        />
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <Link href={`/titulos/${title.id}/editar`} className={btnGhost}>
          Editar ficha
        </Link>
        <form action={deleteAction}>
          <ConfirmSubmit
            label="Borrar"
            confirmMessage={`¿Borrar “${title.name}”?`}
            className={btnDanger}
          />
        </form>
      </div>
    </article>
  );
}
