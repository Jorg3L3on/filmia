import { notFound } from "next/navigation";
import { ListForm } from "@/components/ListForm";
import { getListById } from "@/lib/queries";
import { AUTH_PAGE_DYNAMIC } from "@/lib/rendering";

export const dynamic = AUTH_PAGE_DYNAMIC;

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
    <div className="mx-auto max-w-xl py-2">
      <ListForm list={list} />
    </div>
  );
}
