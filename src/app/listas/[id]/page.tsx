import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListKind } from "@/generated/prisma/client";
import { addTitleToList, deleteList } from "@/app/actions/lists";
import { CatalogFilters } from "@/components/CatalogFilters";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EmptyState } from "@/components/EmptyState";
import { ListTitlesView } from "@/components/ListTitlesView";
import { PageHeader } from "@/components/PageHeader";
import type { DeckViewMode } from "@/components/DeckViewToggle";
import { emptyStateForList, isFixedListSlug, WATCHLIST_SLUG } from "@/lib/lists";
import { getListById, getTags, getTitleOptions } from "@/lib/queries";
import { catalogHref, parseTagSlugs, titleMatchesAnyTag } from "@/lib/tags";
import { btnDanger, btnPrimary, fieldClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; tag?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const view: DeckViewMode = query.view === "grid" ? "grid" : "deck";
  const selectedTags = parseTagSlugs(query.tag);
  const [list, titleOptions, tags] = await Promise.all([
    getListById(id),
    getTitleOptions(),
    getTags(),
  ]);

  if (!list) {
    notFound();
  }

  if (list.kind === ListKind.WATCHLIST || list.slug === WATCHLIST_SLUG) {
    redirect("/watchlist");
  }

  const memberIds = new Set(list.items.map((item) => item.titleId));
  const availableTitles = titleOptions.filter((title) => !memberIds.has(title.id));
  const visibleItems = list.items.filter((item) =>
    titleMatchesAnyTag(item.title.tags, selectedTags),
  );
  const addAction = addTitleToList.bind(null, list.id);
  const deleteAction = deleteList.bind(null, list.id);
  const fixed = isFixedListSlug(list.slug);
  const empty = emptyStateForList(list.slug);
  const filteredEmpty = list.items.length > 0 && visibleItems.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={fixed ? "Lista diaria" : "Lista"}
        title={list.name}
        description={list.description ?? undefined}
        actions={
          <>
            <Link href={`/listas/${list.id}/editar`} className={btnPrimary}>
              {fixed ? "Editar descripción" : "Editar"}
            </Link>
            {fixed ? null : (
              <form action={deleteAction}>
                <ConfirmSubmit
                  label="Borrar lista"
                  confirmMessage={`¿Borrar la lista “${list.name}”?`}
                  className={btnDanger}
                />
              </form>
            )}
          </>
        }
      />

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname={`/listas/${list.id}`}
        view={view}
      />

      <form
        action={addAction}
        className="flex flex-col items-stretch gap-3 rounded-md border border-line bg-well p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="block min-w-0 flex-1 space-y-1">
          <span className="text-xs uppercase tracking-wide text-fog">
            Agregar título
          </span>
          <select name="titleId" required className={fieldClass}>
            <option value="">Elige un título</option>
            {availableTitles.map((title) => (
              <option key={title.id} value={title.id}>
                {title.name}
                {title.year ? ` (${title.year})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${btnPrimary} w-full sm:w-auto`}>
          Agregar
        </button>
      </form>

      {list.items.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : filteredEmpty ? (
        <EmptyState
          title="Nada con esas etiquetas"
          description="Esta lista no tiene títulos con las etiquetas elegidas. El filtro es OR: basta con una."
          actionHref={catalogHref(`/listas/${list.id}`, { view })}
          actionLabel="Quitar filtros"
        />
      ) : (
        <ListTitlesView
          listId={list.id}
          items={visibleItems}
          mode={view}
          selectedTags={selectedTags}
        />
      )}
    </div>
  );
}
