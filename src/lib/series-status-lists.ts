import type { SeriesStatus } from "@/db";
import {
  SERIES_ABANDONADAS_SLUG,
  SERIES_EN_PROGRESO_SLUG,
  SERIES_STATUS_LIST_SLUGS,
  type SeriesStatusListSlug,
} from "@/lib/lists";

/** Lista automática que corresponde a cada estado. Terminada no tiene lista. */
export const SERIES_STATUS_LIST_BY_STATUS: Record<SeriesStatus, SeriesStatusListSlug | null> = {
  WATCHING: SERIES_EN_PROGRESO_SLUG,
  DROPPED: SERIES_ABANDONADAS_SLUG,
  FINISHED: null,
};

export const seriesStatusListSlug = (
  status: SeriesStatus | null | undefined,
): SeriesStatusListSlug | null => (status ? SERIES_STATUS_LIST_BY_STATUS[status] : null);

export type SeriesStatusListTransition = {
  /** Lista en la que la serie debe estar tras el cambio (o null si en ninguna). */
  join: SeriesStatusListSlug | null;
  /**
   * Listas de las que la serie debe salir. Incluye siempre todas las listas por
   * estado distintas de `join`, no solo la del estado anterior: así un dato
   * viejo o incoherente se corrige solo y la operación es idempotente.
   */
  leave: SeriesStatusListSlug[];
  /** La lista del estado anterior cuando deja de aplicar (útil para revalidar). */
  previous: SeriesStatusListSlug | null;
};

export const seriesStatusListTransition = (
  from: SeriesStatus | null | undefined,
  to: SeriesStatus | null | undefined,
): SeriesStatusListTransition => {
  const join = seriesStatusListSlug(to);
  const previous = seriesStatusListSlug(from);

  return {
    join,
    leave: SERIES_STATUS_LIST_SLUGS.filter((slug) => slug !== join),
    previous: previous === join ? null : previous,
  };
};
