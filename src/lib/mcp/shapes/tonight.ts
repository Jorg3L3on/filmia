import { z } from "zod";
import { titleSummary, titleSummaryFields } from "@/lib/mcp/shapes/title";
import { cardPlatforms, type CardRef } from "@/lib/tonight/recommend";
import type { TonightCard } from "@/lib/tonight-store";

/** A card of Hoy or a recommendation, as tools return it. */
export const tonightCardOutput = z.object({
  ...titleSummaryFields,
  source: z
    .enum(["pending", "recommendation"])
    .describe("pending: está en su Quiero ver; recommendation: sugerida por Filmia y aún no la tiene."),
  pinned: z.boolean().describe("La persona la eligió para hoy."),
  reasons: z.array(z.string()).describe("Por qué Filmia la propone (texto para mostrar)."),
  note: z.string().nullable().describe("Nota que la persona dejó en su Quiero ver."),
});

export const tonightCardShape = (card: TonightCard, ref: CardRef | undefined) => ({
  ...titleSummary({
    catalogId: ref?.catalogId ?? card.id,
    titleId: ref?.titleId ?? null,
    tmdbId: ref?.tmdbId ?? card.reco?.tmdbId ?? 0,
    kind: card.kind,
    name: card.name,
    originalName: card.reco?.originalName ?? null,
    year: card.year,
    runtimeMinutes: card.runtimeMinutes,
    genres: card.genres ?? [],
    posterPath: card.posterPath,
    streamingOn: cardPlatforms(card),
  }),
  source: card.source === "queue" ? ("pending" as const) : ("recommendation" as const),
  pinned: card.pinned,
  reasons: card.reasons.map((reason) => reason.text),
  note: card.queueNote ?? null,
});
