import Link from "next/link";
import {
  addToWatchlistFromForm,
  ensureWatchlist,
  markWatchlistItemWatched,
  removeFromWatchlist,
  updateWatchlistNote,
} from "@/app/actions/watchlist";
import { WatchlistCard } from "@/components/WatchlistCard";
import { getTitleOptions, getWatchlist } from "@/lib/queries";
import { WATCHLIST_DESCRIPTION, WATCHLIST_NAME } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Por ver",
};

export default async function WatchlistPage() {
  await ensureWatchlist();
  const [watchlist, titleOptions] = await Promise.all([
    getWatchlist(),
    getTitleOptions(),
  ]);

  const items = watchlist?.items ?? [];
  const memberIds = new Set(items.map((item) => item.titleId));
  const availableTitles = titleOptions.filter((title) => !memberIds.has(title.id));
  const [hero, ...queue] = items;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-[#8b5cf6]">Watchlist</p>
        <h1 className="bg-gradient-to-r from-[#4fc3ff] via-[#a78bfa] to-[#f472b6] bg-clip-text font-serif text-4xl text-transparent md:text-5xl">
          {WATCHLIST_NAME}
        </h1>
        <p className="max-w-2xl text-sm text-[#99aabb]">{WATCHLIST_DESCRIPTION}</p>
        <p className="text-xs text-[#678]">
          {items.length}{" "}
          {items.length === 1 ? "título en cola" : "títulos en cola"}
        </p>
      </div>

      <form
        action={addToWatchlistFromForm}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#2c3440] bg-[#111] p-5"
      >
        <label className="block min-w-56 flex-1 space-y-1">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">
            Agregar a la cola
          </span>
          <select
            name="titleId"
            required
            className="w-full rounded-xl border border-[#2c3440] bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:border-[#8b5cf6] focus:outline-none"
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
        <label className="block min-w-48 flex-1 space-y-1">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">
            Nota (opcional)
          </span>
          <input
            name="queueNote"
            placeholder="Recomendación, mood, etc."
            className="w-full rounded-xl border border-[#2c3440] bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder:text-[#556] focus:border-[#8b5cf6] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-gradient-to-r from-[#2563eb] via-[#7c3aed] to-[#db2777] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Encolar
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#3a3a3a] bg-[#111]/50 p-12 text-center">
          <p className="font-serif text-2xl text-[#99aabb]">La cola está vacía</p>
          <p className="mt-2 text-sm text-[#678]">
            Agrega títulos que quieras ver pronto, o crea uno nuevo.
          </p>
          <Link
            href="/titulos/nuevo"
            className="mt-6 inline-block rounded-full border border-[#7c3aed]/50 px-4 py-2 text-sm text-[#c4b5fd] hover:bg-[#7c3aed]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6]"
          >
            Nuevo título
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {hero ? (
            <WatchlistCard
              item={hero}
              variant="hero"
              position={1}
              markWatchedAction={markWatchlistItemWatched.bind(null, hero.titleId)}
              removeAction={removeFromWatchlist.bind(null, hero.titleId)}
              updateNoteAction={updateWatchlistNote.bind(null, hero.titleId)}
            />
          ) : null}

          {queue.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#678]">
                En cola
              </h2>
              <ul className="space-y-3">
                {queue.map((item, index) => (
                  <li key={item.titleId}>
                    <WatchlistCard
                      item={item}
                      variant="queue"
                      position={index + 2}
                      markWatchedAction={markWatchlistItemWatched.bind(null, item.titleId)}
                      removeAction={removeFromWatchlist.bind(null, item.titleId)}
                      updateNoteAction={updateWatchlistNote.bind(null, item.titleId)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
