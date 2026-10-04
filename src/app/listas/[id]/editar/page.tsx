import { notFound } from "next/navigation";
import { ListForm } from "@/components/ListForm";
import { getListMetaById } from "@/lib/queries";

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

  return (
    <div className="mx-auto max-w-xl py-2">
      <ListForm list={list} />
    </div>
  );
}
