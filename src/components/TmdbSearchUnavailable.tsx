import { EmptyState } from "@/components/EmptyState";
import { TMDB_UNAVAILABLE_COPY } from "@/lib/tmdb";
import { fieldClass } from "@/lib/ui";

/** Server-friendly empty when TMDB is off — avoids mounting the search client island. */
export const TmdbSearchUnavailable = () => (
  <div className="space-y-6">
    <label className="block">
      <span className="sr-only">Buscar títulos</span>
      <input
        disabled
        placeholder="Interestelar, Dune, Severance…"
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
