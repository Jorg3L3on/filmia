import type { PortalCardMeta } from "@/components/coverflow/types";
import type { TonightCard, TonightLensView } from "@/lib/tonight-store";

/**
 * A door in Hoy (FIL-I26): a lens of one card whose face is a message and a link («¿Las viste?»,
 * «Empieza una ruta»). Not a film: no poster, no stub, never counted as something to recommend.
 */
export const doorLens = (slug: string, name: string, portal: PortalCardMeta): TonightLensView => {
  const card: TonightCard = {
    id: `__${slug}__`,
    name,
    kind: "MOVIE",
    year: null,
    rating: null,
    posterPath: null,
    platform: null,
    imdbRating: null,
    runtimeMinutes: null,
    components: { gusto: 0.5, calidad: 0.5, impulso: 0, novedad: 0, reposo: 0, fatiga: 1 },
    reasons: [],
    wildcard: false,
    pinned: false,
    posterAmbient: null,
    queueNote: null,
    overview: null,
    leads: [],
    source: "queue",
    reco: null,
    portal,
  };
  return { slug, name, kind: "pieza", titles: [card] };
};
