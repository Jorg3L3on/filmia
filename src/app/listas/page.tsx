import Link from "next/link";
import { getLists, getWatchlistCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const [lists, watchlistCount] = await Promise.all([getLists(), getWatchlistCount()]);

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

      <Link
        href="/watchlist"
        className="group relative block overflow-hidden rounded-2xl border border-[#2c3440] bg-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6] hover:border-[#7c3aed]/50"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#111] to-[#1a1025] p-6 transition group-hover:from-[#151025] group-hover:to-[#201030]">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8b5cf6]">
              Watchlist · tipo único
            </p>
            <h2 className="bg-gradient-to-r from-[#4fc3ff] via-[#a78bfa] to-[#f472b6] bg-clip-text font-serif text-2xl text-transparent">
              Por ver
            </h2>
            <p className="text-sm text-[#99aabb]">
              Cola personal con orden, notas y botón de “marcar como vista”.
            </p>
          </div>
          <div className="rounded-full bg-[#1a1a2e] px-4 py-2 text-sm font-medium text-[#c4b5fd]">
            {watchlistCount} en cola
          </div>
        </div>
      </Link>

      {lists.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#2c3440] p-8 text-center text-[#99aabb]">
          Todavía no hay listas de colección.
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
