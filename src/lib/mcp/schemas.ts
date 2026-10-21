import { z } from "zod";
import { PLATFORMS } from "@/lib/labels";

/**
 * Shared input and output pieces for every MCP tool (FIL-I20-2). Every field carries a
 * description: it is what the model reads to call the tool well.
 */

const isRealDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
};

/** A calendar date that exists (2026-02-30 does not). */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato YYYY-MM-DD")
  .refine(isRealDate, "Esa fecha no existe");

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_SIZE)
  .optional()
  .describe(`Cuántos resultados devolver (1–${MAX_PAGE_SIZE}, ${DEFAULT_PAGE_SIZE} por defecto).`);

export const cursorSchema = z
  .string()
  .max(200)
  .optional()
  .describe("El next_cursor de la respuesta anterior para seguir la misma consulta. Omítelo para empezar.");

/** `pageFields` for the input of every list_* tool. */
export const pageInput = { limit: limitSchema, cursor: cursorSchema };

/** `pageOutput` for the output of every list_* tool. */
export const pageOutput = {
  limit: z.number().int().describe("Tamaño de página usado."),
  next_cursor: z.string().nullable().describe("Pásalo como cursor para la siguiente página; null cuando no hay más."),
  total_count: z.number().int().describe("Total de resultados de la consulta, en todas las páginas."),
};

/**
 * How a tool names a title: the `id` Filmia returns (catalog id), or a TMDB reference
 * `tmdb:movie:<id>` / `tmdb:tv:<id>` for titles found elsewhere.
 */
export const TITLE_REF_PATTERN = /^(?:[a-z0-9]{20,32}|tmdb:(?:movie|tv):\d{1,9})$/;

export const titleRefSchema = z
  .string()
  .regex(TITLE_REF_PATTERN, "Usa el id que devolvió Filmia o tmdb:movie:<id> / tmdb:tv:<id>")
  .describe("El título: su id en Filmia (campo id de otras tools) o tmdb:movie:<id> / tmdb:tv:<id>.");

export const confirmSchema = z
  .literal(true)
  .describe("Confirmación explícita: pon true solo después de que la persona lo pidió o lo aprobó.");

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(80)
  .regex(/^[A-Za-z0-9._:-]+$/)
  .describe(
    "Clave única por intención (8–80 caracteres, por ejemplo un UUID). Si reintentas la misma acción, reutiliza la misma clave para no duplicarla.",
  );

export const platformSchema = z
  .enum(PLATFORMS as [string, ...string[]])
  .describe("Plataforma de streaming en México (NETFLIX, PRIME, MAX, DISNEY, APPLE, MUBI…).");

export const titleKindSchema = z.enum(["movie", "series"]).describe("movie (película) o series (serie).");

/** A platform as tools return it. */
export const platformOutput = z.object({
  id: z.string().describe("Código de la plataforma."),
  name: z.string().describe("Nombre visible."),
});
