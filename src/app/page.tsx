import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { CatalogFilters } from "@/components/CatalogFilters";
import { DiaryRecentList } from "@/components/DiaryRecentList";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import { getTags, getTitles, getUserStreamingPlatforms } from "@/lib/queries";
import { resolveMinePlatformsCatalog } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs } from "@/lib/tags";

export const dynamic = "force-dynamic";

const isView = (value: string | undefined): value is DeckViewMode =>
  value === "deck" || value === "grid";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    tag?: string | string[];
    minePlatforms?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const view = isView(params.view) ? params.view : "deck";
  const selectedTags = parseTagSlugs(params.tag);
  const minePlatforms = parseMinePlatforms(params.minePlatforms);

  const [taggedTitles, tags, userPlatforms] = await Promise.all([
    getTitles({
      sort: "watched",
      onlyWatched: true,
      tags: selectedTags,
    }),
    getTags(),
    getUserStreamingPlatforms(),
  ]);

  const catalog = resolveMinePlatformsCatalog(
    taggedTitles,
    minePlatforms,
    userPlatforms,
  );
  const titles = catalog.titles;
  const recentTitles = titles.slice(0, 12);
  const hasActiveFilters = selectedTags.length > 0 || minePlatforms;
  const hrefFor = (mode: DeckViewMode) =>
    catalogHref("/", { tags: selectedTags, view: mode, minePlatforms });
  const clearHref = catalogHref("/", { view });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diario"
        title="Lo visto"
        description="Mazo y cuadrícula de lo que ya viste. Filtra por etiqueta (OR) o por las plataformas que tienes."
        actions={
          titles.length > 0 || hasActiveFilters ? (
            <DeckViewToggle mode={view} hrefFor={hrefFor} />
          ) : undefined
        }
      />

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname="/"
        view={view}
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
      />

      {catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : titles.length === 0 && minePlatforms ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={userPlatforms}
            actionHref={clearHref}
            hasTagFilters={selectedTags.length > 0}
          />
        </>
      ) : titles.length === 0 ? (
        <EmptyState
          title={
            selectedTags.length > 0
              ? "Nada con esas etiquetas"
              : "El diario está vacío"
          }
          description={
            selectedTags.length > 0
              ? "Prueba otra combinación o quita filtros. Un título entra si tiene cualquiera de las etiquetas."
              : "Registra un título o corre el seed para ver tus posters."
          }
          actionHref={hasActiveFilters ? clearHref : "/buscar"}
          actionLabel={hasActiveFilters ? "Quitar filtros" : "Buscar en TMDB"}
        />
      ) : (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <TitleDeckView
            heading="Recientes"
            titles={recentTitles}
            mode={view}
            showToggle={false}
          />
          <DiaryRecentList titles={recentTitles} />
          {titles.length > recentTitles.length ? (
            <TitleDeckView
              heading="Todos"
              titles={titles}
              mode={view}
              showToggle={false}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
