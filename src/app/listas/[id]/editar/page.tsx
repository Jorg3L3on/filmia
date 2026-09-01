import { notFound } from "next/navigation";
import { ListForm } from "@/components/ListForm";
import { getListById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await getListById(id);

  if (!list) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#00e054]">Editar</p>
        <h1 className="font-serif text-4xl text-white">{list.name}</h1>
      </div>
      <ListForm list={list} />
    </div>
  );
}
