import { CatalogFilters } from "@/components/CatalogFilters";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import { TitlePosterRail } from "@/components/TitlePosterRail";
import type { DeckViewMode } from "@/components/DeckViewToggle";
import type { Platform, TitleKind } from "@/generated/prisma/client";
import { getTags, getTitles } from "@/lib/queries";

export const dynamic = "force-dynamic";

const isTitleKind = (value: string): value is TitleKind =>
  value === "MOVIE" || value === "SERIES";

const isPlatform = (value: string): value is Platform =>
  ["NETFLIX", "PRIME", "MAX", "DISNEY", "CLARO", "APPLE", "MUBI"].includes(
    value,
  );

const isSort = (
  value: string,
): value is "recent" | "watched" | "rating" | "name" | "year" =>
  ["recent", "watched", "rating", "name", "year"].includes(value);

const isView = (value: string): value is DeckViewMode =>
  value === "calendar" || value === "deck" || value === "grid";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const kindRaw = typeof params.kind === "string" ? params.kind : "ALL";
  const platformRaw = typeof params.platform === "string" ? params.platform : "ALL";
  const tag = typeof params.tag === "string" ? params.tag : "";
  const sortRaw = typeof params.sort === "string" ? params.sort : "watched";
  const viewRaw = typeof params.view === "string" ? params.view : "calendar";
  const view = isView(viewRaw) ? viewRaw : "calendar";

  const [titles, tags] = await Promise.all([
    getTitles({
      q,
      kind: isTitleKind(kindRaw) ? kindRaw : "ALL",
      platform: isPlatform(platformRaw) ? platformRaw : "ALL",
      tag,
      sort: isSort(sortRaw) ? sortRaw : "watched",
      onlyWatched: true,
    }),
    getTags(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diario"
        title="Lo visto"
        description="Calendario de posters, mazo y cuadrícula de lo que ya viste. La cola vive en Por ver."
      />

      <CatalogFilters
        q={q}
        kind={kindRaw}
        platform={platformRaw}
        tag={tag}
        sort={sortRaw}
        view={view}
        tags={tags}
      />

      {titles.length === 0 ? (
        <EmptyState
          title="El diario está vacío"
          description="Registra un título o corre el seed para ver el calendario de posters."
          actionHref="/titulos/nuevo"
          actionLabel="Registrar título"
        />
      ) : (
        <>
          <TitlePosterRail
            title="Recientes"
            ariaLabel="Títulos vistos recientemente"
            titles={titles.slice(0, 12)}
          />
          <TitleDeckView
            titles={titles}
            mode={view}
            modes={["calendar", "deck", "grid"]}
            hrefFor={(mode) => {
              const query = new URLSearchParams();
              if (q) query.set("q", q);
              if (kindRaw !== "ALL") query.set("kind", kindRaw);
              if (platformRaw !== "ALL") query.set("platform", platformRaw);
              if (tag) query.set("tag", tag);
              if (sortRaw !== "watched") query.set("sort", sortRaw);
              if (mode !== "calendar") query.set("view", mode);
              const encoded = query.toString();
              return encoded ? `/?${encoded}` : "/";
            }}
          />
        </>
      )}
    </div>
  );
}
