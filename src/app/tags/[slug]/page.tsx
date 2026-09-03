import { notFound } from "next/navigation";
import { CatalogFilters } from "@/components/CatalogFilters";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { TagSortLinks } from "@/components/TagSortLinks";
import { TitleDeckView } from "@/components/TitleDeckView";
import { TitleRankingList } from "@/components/TitleRankingList";
import type { DeckViewMode } from "@/components/DeckViewToggle";
import { getTagBySlug, getTitles, getUserStreamingPlatforms } from "@/lib/queries";
import { resolveMinePlatformsCatalog } from "@/lib/streaming-platforms";
import {
  catalogHref,
  isCatalogSort,
  parseMinePlatforms,
  tagHref,
  type CatalogSort,
} from "@/lib/tags";
import { btnGhost } from "@/lib/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

type TagDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    view?: string;
    sort?: string;
    minePlatforms?: string | string[];
  }>;
};

export const generateMetadata = async ({ params }: TagDetailPageProps) => {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  return { title: tag?.name ?? "Etiqueta" };
};

const isView = (value: string | undefined): value is DeckViewMode =>
  value === "deck" || value === "grid";

export default async function TagDetailPage({
  params,
  searchParams,
}: TagDetailPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const view: DeckViewMode = isView(query.view) ? query.view : "deck";
  const sort: CatalogSort = isCatalogSort(query.sort) ? query.sort : "rating";
  const minePlatforms = parseMinePlatforms(query.minePlatforms);

  const [tag, taggedTitles, userPlatforms] = await Promise.all([
    getTagBySlug(slug),
    getTitles({ tags: [slug], sort }),
    getUserStreamingPlatforms(),
  ]);

  if (!tag) {
    notFound();
  }

  const catalog = resolveMinePlatformsCatalog(
    taggedTitles,
    minePlatforms,
    userPlatforms,
  );
  const titles = catalog.titles;
  const pathname = tagHref(tag.slug);
  const hrefFor = (mode: DeckViewMode) =>
    catalogHref(pathname, {
      view: mode,
      sort: sort === "rating" ? null : sort,
      minePlatforms,
    });
  const clearHref = catalogHref(pathname, {
    view,
    sort: sort === "rating" ? null : sort,
  });

  const countLabel =
    titles.length === 1 ? "1 título" : `${titles.length} títulos`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ranking"
        title={tag.name}
        description={`${countLabel} con esta etiqueta. Ordena por nota o por fecha vista. Filtra por tus plataformas.`}
        actions={
          <Link href="/tags" className={btnGhost}>
            Todas las etiquetas
          </Link>
        }
      />

      <CatalogFilters
        tags={[]}
        selectedSlugs={[]}
        pathname={pathname}
        view={view}
        sort={sort === "rating" ? undefined : sort}
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        showTagFilters={false}
      />

      <TagSortLinks
        pathname={pathname}
        current={sort}
        view={view}
        minePlatforms={minePlatforms}
      />

      {catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : titles.length === 0 && minePlatforms ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={userPlatforms}
            actionHref={clearHref}
          />
        </>
      ) : titles.length === 0 ? (
        <EmptyState
          title="Nada en esta etiqueta"
          description="Asigna el tag desde la ficha de un título, con las pastillas rápidas."
          actionHref="/"
          actionLabel="Ir al diario"
        />
      ) : (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <TitleDeckView
            heading="Mazo"
            titles={titles}
            mode={view}
            hrefFor={hrefFor}
          />
          <TitleRankingList titles={titles} />
        </>
      )}
    </div>
  );
}
