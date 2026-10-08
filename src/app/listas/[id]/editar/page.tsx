import { notFound } from "next/navigation";
import { deleteList } from "@/app/actions/lists";
import { DeleteCollectionButton } from "@/components/DeleteCollectionButton";
import { ListForm } from "@/components/ListForm";
import { isFixedListSlug } from "@/lib/lists";
import { getListItemCount, getListMetaById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await getListMetaById(id);

  if (!list) {
    notFound();
  }

  const itemCount = isFixedListSlug(list.slug) ? 0 : await getListItemCount(list.id);

  return (
    <div className="mx-auto max-w-xl space-y-10 py-2">
      <ListForm list={list} />
      {isFixedListSlug(list.slug) ? null : (
        <footer className="flex justify-center border-t border-line/70 pt-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <DeleteCollectionButton
            action={deleteList.bind(null, list.id)}
            redirectHref="/listas"
            label="Borrar lista"
            name={list.name}
            impact={
              itemCount === 0
                ? "La lista está vacía."
                : `Contiene ${itemCount === 1 ? "1 título" : `${itemCount} títulos`}.`
            }
          />
        </footer>
      )}
    </div>
  );
}
