import { DockSearchDisabled } from "@/components/DockSearchDisabled";
import { EmptyState } from "@/components/EmptyState";
import { TMDB_UNAVAILABLE_COPY } from "@/lib/tmdb";
import { fieldClass } from "@/lib/ui";

/** Server-friendly empty when TMDB is off — avoids mounting the search client island. */
export const TmdbSearchUnavailable = () => (
  <div className="space-y-6">
    {/* The dock's field (phones) goes quiet too (FIL-I22-7). */}
    <DockSearchDisabled />
    <label className="hidden sm:block">
      <span className="sr-only">Buscar películas, series o directores</span>
      <input
        disabled
        placeholder="Películas, series o directores"
        className={`${fieldClass} cursor-not-allowed py-3 text-base opacity-60`}
        aria-disabled="true"
      />
    </label>
    <EmptyState
      variant="buscar"
      title="Búsqueda no disponible"
      description={TMDB_UNAVAILABLE_COPY}
      actionHref="/watchlist"
      actionLabel="Ir a Quiero ver"
    />
  </div>
);
