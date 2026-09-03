import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { CatalogFilters } from "@/components/CatalogFilters";
import { DiaryRecentList } from "@/components/DiaryRecentList";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import { getTags, getTitles } from "@/lib/queries";
import { catalogHref, parseTagSlugs } from "@/lib/tags";

export const dynamic = "force-dynamic";

const isView = (value: string | undefined): value is DeckViewMode =>
  value === "deck" || value === "grid";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tag?: string | string[] }>;
}) {
  const params = await searchParams;
  const view = isView(params.view) ? params.view : "deck";
  const selectedTags = parseTagSlugs(params.tag);

  const [titles, tags] = await Promise.all([
    getTitles({
      sort: "watched",
      onlyWatched: true,
      tags: selectedTags,
    }),
    getTags(),
  ]);
  const recentTitles = titles.slice(0, 12);
  const hrefFor = (mode: DeckViewMode) =>
    catalogHref("/", { tags: selectedTags, view: mode });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diario"
        title="Lo visto"
        description="Mazo y cuadrícula de lo que ya viste. Filtra por etiqueta (OR) o entra al ranking de un tag."
        actions={
          titles.length > 0 || selectedTags.length > 0 ? (
            <DeckViewToggle mode={view} hrefFor={hrefFor} />
          ) : undefined
        }
      />

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname="/"
        view={view}
      />

      {titles.length === 0 ? (
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
          actionHref={selectedTags.length > 0 ? catalogHref("/") : "/buscar"}
          actionLabel={selectedTags.length > 0 ? "Quitar filtros" : "Buscar en TMDB"}
        />
      ) : (
        <>
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
