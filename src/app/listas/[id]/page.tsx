import Link from "next/link";
import { notFound } from "next/navigation";
import { addTitleToList, deleteList } from "@/app/actions/lists";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { ListTitlesView } from "@/components/ListTitlesView";
import { getListById, getTitleOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [list, titleOptions] = await Promise.all([
    getListById(id),
    getTitleOptions(),
  ]);

  if (!list) {
    notFound();
  }

  const memberIds = new Set(list.items.map((item) => item.titleId));
  const availableTitles = titleOptions.filter((title) => !memberIds.has(title.id));
  const addAction = addTitleToList.bind(null, list.id);
  const deleteAction = deleteList.bind(null, list.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#00e054]">Lista</p>
          <h1 className="font-serif text-4xl text-white">{list.name}</h1>
          {list.description ? (
            <p className="mt-2 max-w-2xl text-sm text-[#99aabb]">{list.description}</p>
          ) : null}
        </div>
        <div className="flex gap-3">
          <Link
            href={`/listas/${list.id}/editar`}
            className="rounded-full bg-[#00e054] px-4 py-2 text-sm font-semibold text-[#14181c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Editar
          </Link>
          <form action={deleteAction}>
            <ConfirmSubmit
              label="Borrar lista"
              confirmMessage={`¿Borrar la lista “${list.name}”?`}
              className="rounded-full border border-[#5a2a2a] px-4 py-2 text-sm text-[#ff8a80] hover:bg-[#2a1616] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a80]"
            />
          </form>
        </div>
      </div>

      <form
        action={addAction}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[#2c3440] bg-[#1c2228] p-4"
      >
        <label className="block min-w-56 flex-1 space-y-1">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">
            Agregar título
          </span>
          <select
            name="titleId"
            required
            className="w-full rounded-md border border-[#2c3440] bg-[#14181c] px-3 py-2 text-sm text-white focus:border-[#00e054] focus:outline-none"
          >
            <option value="">Elige un título</option>
            {availableTitles.map((title) => (
              <option key={title.id} value={title.id}>
                {title.name}
                {title.year ? ` (${title.year})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-[#2c3440] px-4 py-2 text-sm text-white hover:bg-[#3a4452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
        >
          Agregar
        </button>
      </form>

      {list.items.length === 0 ? (
        <p className="text-[#99aabb]">Esta lista está vacía.</p>
      ) : (
        <ListTitlesView listId={list.id} items={list.items} />
      )}
    </div>
  );
}
