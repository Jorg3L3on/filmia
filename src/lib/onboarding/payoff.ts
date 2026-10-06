import type { Platform, TitleKind } from "@/db";
import { primaryAvailabilityPlatform } from "@/lib/streaming-platforms";
import { rankForNow } from "@/lib/tonight/serve";
import { nightEndsLabel } from "@/lib/tonight/time";
import type { TonightDecks } from "@/lib/tonight-store";

/** Serializable card for «Tu primera noche» (client component, so no Dates / Maps). */
export type PayoffCard = {
  id: string;
  name: string;
  kind: TitleKind;
  year: number | null;
  posterPath: string | null;
  posterAmbient: string | null;
  imdbRating: number | null;
  runtimeMinutes: number | null;
  platform: Platform | null;
  providerName: string | null;
  genres: string[];
  /** Best personal reason, e.g. «Porque le diste 5★ a Interestelar». */
  reason: string | null;
  /** «acaba a las 23:19» — only when a runtime is known. */
  endsAt: string | null;
  overflowMinutes: number;
  night: boolean;
  nightEndsAt: string;
};

export type PayoffEmptyKind = "no-platforms" | "empty-queue" | "nothing-on-platforms";

export type PayoffPayload =
  | { kind: "card"; card: PayoffCard; queueSize: number }
  | { kind: "empty"; empty: PayoffEmptyKind; queueSize: number };

export const PAYOFF_EMPTY_COPY: Record<PayoffEmptyKind, { title: string; description: string }> = {
  "no-platforms": {
    title: "Elige tus plataformas",
    description: "Hoy solo muestra lo incluido en tus suscripciones de México. Puedes indicarlas en Perfil.",
  },
  "empty-queue": {
    title: "Aún no hay nada en Quiero ver",
    description: "Añade títulos desde Buscar o desde una ficha y Hoy elegirá por ti.",
  },
  "nothing-on-platforms": {
    title: "Tu mazo está vacío",
    description: "Hoy solo cuenta lo incluido en tus plataformas. Renta y compra no cuentan.",
  },
};

export const payoffEmptyKind = (decks: Pick<TonightDecks, "userPlatforms" | "queueSize">): PayoffEmptyKind => {
  if (decks.userPlatforms.length === 0) {
    return "no-platforms";
  }
  return decks.queueSize === 0 ? "empty-queue" : "nothing-on-platforms";
};

/** The #1 card for right now: Para ti ranked with the clock, else the first lens. */
export const pickPayoffCard = (decks: TonightDecks, now: Date): PayoffCard | null => {
  const lens = decks.lenses[0];
  if (!lens || lens.titles.length === 0) {
    return null;
  }
  const [top] = rankForNow(lens.titles, {
    now,
    nightEnds: decks.nightEnds,
    keepWildcardLast: true,
    keepPinnedFirst: true,
  });
  if (!top) {
    return null;
  }
  const personal = top.headline.find((reason) => reason.personal) ?? top.headline[0] ?? null;
  const platform = primaryAvailabilityPlatform(
    top.flatrateProviders,
    top.platform,
    decks.userPlatforms,
  );
  const night = top.reasons.some((reason) => reason.kind === "fit" || reason.kind === "fit_over");
  return {
    id: top.id,
    name: top.name,
    kind: top.kind,
    year: top.year,
    posterPath: top.posterPath,
    posterAmbient: top.posterAmbient,
    imdbRating: top.imdbRating,
    runtimeMinutes: top.runtimeMinutes,
    platform,
    providerName: platform ? null : (top.flatrateProviders?.[0]?.name ?? null),
    genres: (top.genres ?? []).map((genre) => genre.name).slice(0, 3),
    reason: personal?.text ?? null,
    endsAt: top.runtimeMinutes ? top.fit.endsAt : null,
    overflowMinutes: top.fit.overflowMinutes,
    night,
    nightEndsAt: nightEndsLabel(now, decks.nightEnds),
  };
};
