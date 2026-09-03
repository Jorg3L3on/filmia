import { DeckViewToggle, type DeckViewMode } from "@/components/DeckViewToggle";
import { DiaryRecentList } from "@/components/DiaryRecentList";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import { getTitles } from "@/lib/queries";

export const dynamic = "force-dynamic";

const isView = (value: string): value is DeckViewMode =>
  value === "deck" || value === "grid";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const viewRaw = typeof params.view === "string" ? params.view : "deck";
  const view = isView(viewRaw) ? viewRaw : "deck";

  const titles = await getTitles({
    sort: "watched",
    onlyWatched: true,
  });
  const recentTitles = titles.slice(0, 12);
  const hrefFor = (mode: DeckViewMode) => (mode === "deck" ? "/" : `/?view=${mode}`);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diario"
        title="Lo visto"
        description="Mazo y cuadrícula de lo que ya viste. La cola vive en Quiero ver."
        actions={
          titles.length > 0 ? (
            <DeckViewToggle mode={view} hrefFor={hrefFor} />
          ) : undefined
        }
      />

      {titles.length === 0 ? (
        <EmptyState
          title="El diario está vacío"
          description="Registra un título o corre el seed para ver tus posters."
          actionHref="/buscar"
          actionLabel="Buscar en TMDB"
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
