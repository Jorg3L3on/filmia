import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PosterImage } from "@/components/PosterImage";
import { getLists, getWatchlistCount } from "@/lib/queries";
import { btnPrimary, focusRing, posterFrame } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const [lists, watchlistCount] = await Promise.all([getLists(), getWatchlistCount()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Colecciones"
        title="Listas"
        actions={
          <Link href="/listas/nueva" className={btnPrimary}>
            Nueva lista
          </Link>
        }
      />

      <Link
        href="/watchlist"
        className={`block overflow-hidden rounded-md border border-line bg-well p-5 transition hover:border-accent/40 ${focusRing}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
              Watchlist
            </p>
            <h2 className="font-serif text-2xl text-white">Por ver</h2>
            <p className="text-sm text-fog">
              Cola personal con orden, notas y botón de “marcar como vista”.
            </p>
          </div>
          <div className="rounded-full bg-canvas px-4 py-2 text-sm font-medium text-accent">
            {watchlistCount} en cola
          </div>
        </div>
      </Link>

      {lists.length === 0 ? (
        <EmptyState
          title="Todavía no hay listas"
          description="Crea una colección para agrupar títulos con el mismo mood."
          actionHref="/listas/nueva"
          actionLabel="Nueva lista"
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {lists.map((list) => {
            const posters = list.items.slice(0, 5).map((item) => item.title);

            return (
              <li key={list.id}>
                <Link
                  href={`/listas/${list.id}`}
                  className={`block rounded-md border border-line bg-well p-5 transition hover:border-accent/40 ${focusRing}`}
                >
                  {posters.length > 0 ? (
                    <div className="mb-4 flex">
                      {posters.map((title, index) => (
                        <div
                          key={title.id}
                          className={`${posterFrame} w-12 ring-2 ring-well`}
                          style={{ marginLeft: index === 0 ? 0 : -10 }}
                        >
                          <PosterImage
                            name={title.name}
                            posterPath={title.posterPath}
                            sizes="48px"
                            className="rounded-poster"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <h2 className="font-serif text-2xl text-white">{list.name}</h2>
                  <p className="mt-1 text-sm text-fog">
                    {list._count.items}{" "}
                    {list._count.items === 1 ? "título" : "títulos"}
                  </p>
                  {list.description ? (
                    <p className="mt-2 text-sm text-paper/80">{list.description}</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
