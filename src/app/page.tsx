import { CatalogFilters } from "@/components/CatalogFilters";
import { TitleDeckView } from "@/components/TitleDeckView";
import type { Platform, TitleKind } from "@/generated/prisma/client";
import { getTags, getTitles } from "@/lib/queries";

export const dynamic = "force-dynamic";

const isTitleKind = (value: string): value is TitleKind =>
  value === "MOVIE" || value === "SERIES";

const isPlatform = (value: string): value is Platform =>
  ["NETFLIX", "PRIME", "MAX", "DISNEY", "CLARO"].includes(value);

const isSort = (
  value: string,
): value is "recent" | "rating" | "name" | "year" =>
  ["recent", "rating", "name", "year"].includes(value);

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const kindRaw = typeof params.kind === "string" ? params.kind : "ALL";
  const platformRaw = typeof params.platform === "string" ? params.platform : "ALL";
  const tag = typeof params.tag === "string" ? params.tag : "";
  const sortRaw = typeof params.sort === "string" ? params.sort : "recent";

  const [titles, tags] = await Promise.all([
    getTitles({
      q,
      kind: isTitleKind(kindRaw) ? kindRaw : "ALL",
      platform: isPlatform(platformRaw) ? platformRaw : "ALL",
      tag,
      sort: isSort(sortRaw) ? sortRaw : "recent",
    }),
    getTags(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[#00e054]">Diario</p>
        <h1 className="font-serif text-4xl text-white">Lo visto</h1>
        <p className="max-w-2xl text-sm text-[#99aabb]">
          Catálogo personal de películas y series. Notas, etiquetas y listas, sin
          IMDb ni scrapers.
        </p>
      </div>

      <CatalogFilters
        q={q}
        kind={kindRaw}
        platform={platformRaw}
        tag={tag}
        sort={sortRaw}
        tags={tags}
      />

      {titles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#2c3440] p-8 text-center text-[#99aabb]">
          No hay títulos todavía. Crea uno o corre el seed.
        </p>
      ) : (
        <TitleDeckView titles={titles} />
      )}
    </div>
  );
}
