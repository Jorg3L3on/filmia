import { notFound } from "next/navigation";
import { TitleForm } from "@/components/TitleForm";
import { getLists, getTags, getTitleById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditTitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [title, tags, lists] = await Promise.all([
    getTitleById(id),
    getTags(),
    getLists(),
  ]);

  if (!title) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#00e054]">Editar</p>
        <h1 className="font-serif text-4xl text-white">{title.name}</h1>
      </div>
      <TitleForm title={title} tags={tags} lists={lists} />
    </div>
  );
}
