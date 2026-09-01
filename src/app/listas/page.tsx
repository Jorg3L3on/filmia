import Link from "next/link";
import { getLists } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const lists = await getLists();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#00e054]">Colecciones</p>
          <h1 className="font-serif text-4xl text-white">Listas</h1>
        </div>
        <Link
          href="/listas/nueva"
          className="rounded-full bg-[#00e054] px-4 py-2 text-sm font-semibold text-[#14181c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Nueva lista
        </Link>
      </div>

      {lists.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#2c3440] p-8 text-center text-[#99aabb]">
          Todavía no hay listas.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/listas/${list.id}`}
                className="block rounded-lg border border-[#2c3440] bg-[#1c2228] p-5 hover:border-[#00e054]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
              >
                <h2 className="font-serif text-2xl text-white">{list.name}</h2>
                <p className="mt-1 text-sm text-[#99aabb]">
                  {list._count.items}{" "}
                  {list._count.items === 1 ? "título" : "títulos"}
                </p>
                {list.description ? (
                  <p className="mt-2 text-sm text-[#c8d6e5]">{list.description}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
