import { z } from "zod";
import type { Platform, TitleKind } from "@/db/schema";
import { platformOutput } from "@/lib/mcp/schemas";
import { appUrl, isoDay, platformShape, posterUrl } from "@/lib/mcp/shapes/common";
import { ownedFichaHref, previewFichaHref } from "@/lib/title-preview";

/** How every tool describes a film or series (FIL-I20-3). */
export const titleSummaryFields = {
  id: z.string().describe("Id del título en Filmia; úsalo en get_title, mark_seen, add_to_list…"),
  title: z.string().describe("Título en español (o el que muestra Filmia)."),
  original_title: z.string().nullable().describe("Título original, si es distinto."),
  type: z.enum(["movie", "series"]).describe("movie (película) o series (serie)."),
  year: z.number().int().nullable().describe("Año de estreno."),
  runtime_min: z.number().int().nullable().describe("Duración en minutos (por episodio en series)."),
  genres: z.array(z.string()).describe("Géneros (TMDB)."),
  streaming_on: z.array(platformOutput).describe("Plataformas donde se puede ver incluido en la suscripción en México."),
  poster_url: z.string().nullable().describe("Póster (TMDB)."),
  url: z.string().describe("Ficha en Filmia."),
};

export const titleSummaryOutput = z.object(titleSummaryFields);

export type TitleSummaryInput = {
  catalogId: string;
  titleId?: string | null;
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName?: string | null;
  year?: number | null;
  runtimeMinutes?: number | null;
  genres?: { name: string }[] | null;
  posterPath?: string | null;
  streamingOn?: Platform[];
};

/** Ficha URL: the person's own title, or the TMDB preview for one they do not have. */
export const fichaUrl = (input: { titleId?: string | null; tmdbId: number; kind: TitleKind }) =>
  appUrl(input.titleId ? ownedFichaHref(input.titleId) : previewFichaHref(input.kind, input.tmdbId));

export const titleSummary = (input: TitleSummaryInput) => ({
  id: input.catalogId,
  title: input.name,
  original_title: input.originalName && input.originalName !== input.name ? input.originalName : null,
  type: input.kind === "SERIES" ? ("series" as const) : ("movie" as const),
  year: input.year ?? null,
  runtime_min: input.runtimeMinutes ?? null,
  genres: (input.genres ?? []).map((genre) => genre.name),
  streaming_on: (input.streamingOn ?? []).map(platformShape),
  poster_url: posterUrl(input.posterPath),
  url: fichaUrl({ titleId: input.titleId, tmdbId: input.tmdbId, kind: input.kind }),
});

/** The person's own data about a title. */
export const personalFields = {
  status: z
    .enum(["pending", "watching", "watched", "saved", "not_in_library"])
    .describe("pending (Quiero ver), watching (serie en curso), watched (vista), saved (guardada sin estado) o not_in_library."),
  my_rating: z.number().int().min(1).max(10).nullable().describe("Calificación de la persona, de 1 a 10 (5 estrellas = 10)."),
  watched_on: z.string().nullable().describe("Fecha en que la vio (YYYY-MM-DD)."),
};

export const ratingOrNull = (rating: number | null | undefined) => (rating == null ? null : rating);

export { isoDay };
