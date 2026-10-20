import { z } from "zod";
import { defineTool } from "@/lib/mcp/define-tool";
import { platformSchema, titleKindSchema } from "@/lib/mcp/schemas";
import { tonightCardOutput, tonightCardShape } from "@/lib/mcp/shapes/tonight";
import { recommendForUser, resolveCardRefs } from "@/lib/tonight/recommend";
import { getTonightDecks } from "@/lib/tonight-store";
import type { Platform } from "@/db/schema";

export const getTonightTool = defineTool({
  name: "get_tonight",
  title: "Hoy en Filmia",
  description:
    "La selección de Hoy de la persona, igual que la pantalla Hoy: por lentes (Para ti primero, luego géneros), mezclando su Quiero ver y recomendaciones, solo lo que está en sus plataformas. Úsala para «¿qué vemos hoy?».",
  scope: "read",
  input: {
    per_lens: z.number().int().min(1).max(12).optional().describe("Títulos por lente (6 por defecto)."),
    lens: z.string().max(60).optional().describe("Solo esta lente (su slug, por ejemplo para-ti)."),
  },
  output: {
    computed_at: z.string().describe("Cuándo se calculó la selección (ISO 8601)."),
    lenses: z
      .array(
        z.object({
          slug: z.string().describe("Identificador de la lente."),
          name: z.string().describe("Nombre visible (Para ti, Thriller…)."),
          titles: z.array(tonightCardOutput).describe("Títulos de la lente, en orden."),
        }),
      )
      .describe("Lentes de Hoy."),
  },
  run: async ({ userId, now }, args) => {
    const decks = await getTonightDecks(userId, now);
    const perLens = args.per_lens ?? 6;
    const lenses = decks.lenses
      .filter((lens) => !args.lens || lens.slug === args.lens)
      .map((lens) => ({ ...lens, titles: lens.titles.slice(0, perLens) }));
    const refs = await resolveCardRefs(userId, lenses.flatMap((lens) => lens.titles));
    return {
      computed_at: decks.computedAt,
      lenses: lenses.map((lens) => ({
        slug: lens.slug,
        name: lens.name,
        titles: lens.titles.map((card) => tonightCardShape(card, refs.get(card.id))),
      })),
    };
  },
});

export const recommendTool = defineTool({
  name: "recommend",
  title: "Recomendar qué ver",
  description:
    "Recomendaciones para la persona con filtros: plataformas (por defecto las suyas), duración máxima, tipo y género. Solo devuelve títulos que se pueden ver incluidos en esas plataformas en México. Úsala para «algo de menos de 2 h en Netflix».",
  scope: "read",
  input: {
    platforms: z.array(platformSchema).max(14).optional().describe("Solo en estas plataformas; por defecto, las de la persona."),
    max_runtime_min: z.number().int().min(20).max(600).optional().describe("Duración máxima en minutos."),
    type: titleKindSchema.optional(),
    genre: z.string().min(2).max(40).optional().describe("Género en español, por ejemplo comedia o thriller."),
    limit: z.number().int().min(1).max(25).optional().describe("Cuántas devolver (10 por defecto)."),
  },
  output: {
    applied: z
      .object({
        platforms: z.array(z.string()).describe("Plataformas usadas."),
        max_runtime_min: z.number().int().nullable().describe("Duración máxima usada."),
        type: z.string().nullable().describe("Tipo usado."),
        genre: z.string().nullable().describe("Género usado."),
      })
      .describe("Filtros aplicados."),
    results: z.array(tonightCardOutput).describe("Recomendaciones en orden de preferencia."),
    total_count: z.number().int().describe("Cuántas cumplen los filtros en total."),
  },
  run: async ({ userId, now }, args) => {
    const { decks, cards } = await recommendForUser(
      userId,
      {
        platforms: args.platforms as Platform[] | undefined,
        maxRuntimeMin: args.max_runtime_min,
        kind: args.type === "series" ? "SERIES" : args.type === "movie" ? "MOVIE" : undefined,
        genre: args.genre,
      },
      now,
    );
    const page = cards.slice(0, args.limit ?? 10);
    const refs = await resolveCardRefs(userId, page);
    return {
      applied: {
        platforms: args.platforms?.length ? args.platforms : decks.userPlatforms,
        max_runtime_min: args.max_runtime_min ?? null,
        type: args.type ?? null,
        genre: args.genre ?? null,
      },
      results: page.map((card) => tonightCardShape(card, refs.get(card.id))),
      total_count: cards.length,
    };
  },
});
