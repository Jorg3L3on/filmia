import {
  addToWatchlistFromForm,
  ensureCurrentUserWatchlist,
  removeFromWatchlist,
  updateWatchlistNote,
} from "@/app/actions/watchlist";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { WatchlistCard } from "@/components/WatchlistCard";
import { TitlePosterRail } from "@/components/TitlePosterRail";
import { getTitleOptions, getWatchlist } from "@/lib/queries";
import { btnPrimary, fieldClass } from "@/lib/ui";
import { WATCHLIST_DESCRIPTION, WATCHLIST_NAME } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Por ver",
};

export default async function WatchlistPage() {
  await ensureCurrentUserWatchlist();
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
      <PageHeader
        eyebrow="Watchlist"
        title={WATCHLIST_NAME}
        description={WATCHLIST_DESCRIPTION}
      />
      <p className="text-xs text-mist">
        {items.length}{" "}
        {items.length === 1 ? "título en cola" : "títulos en cola"}
      </p>

      <form
        action={addToWatchlistFromForm}
        className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-well p-5"
      >
        <label className="block min-w-56 flex-1 space-y-1">
          <span className="text-xs uppercase tracking-wide text-fog">
            Agregar a la cola
          </span>
          <select name="titleId" required className={fieldClass}>
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
          <span className="text-xs uppercase tracking-wide text-fog">
            Nota (opcional)
          </span>
          <input
            name="queueNote"
            placeholder="Recomendación, mood, etc."
            className={fieldClass}
          />
        </label>
        <button type="submit" className={btnPrimary}>
          Encolar
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="La cola está vacía"
          description="Agrega títulos que quieras ver pronto, o registra uno nuevo."
          actionHref="/titulos/nuevo"
          actionLabel="Registrar título"
        />
      ) : (
        <div className="space-y-8">
          <TitlePosterRail
            title="En cola"
            ariaLabel="Posters de la cola"
            titles={items.slice(0, 12).map((item) => item.title)}
          />
          {hero ? (
            <WatchlistCard
              item={hero}
              variant="hero"
              position={1}
              removeAction={removeFromWatchlist.bind(null, hero.titleId)}
              updateNoteAction={updateWatchlistNote.bind(null, hero.titleId)}
            />
          ) : null}

          {queue.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-xs uppercase tracking-[0.2em] text-mist">
                Siguen
              </h2>
              <ul className="space-y-3">
                {queue.map((item, index) => (
                  <li key={item.titleId}>
                    <WatchlistCard
                      item={item}
                      variant="queue"
                      position={index + 2}
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
