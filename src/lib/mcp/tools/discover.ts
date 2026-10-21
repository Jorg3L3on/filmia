import { z } from "zod";
import { getNowShowing, getUpcoming } from "@/lib/cine";
import { paginate, queryKey } from "@/lib/mcp/cursor";
import { defineTool } from "@/lib/mcp/define-tool";
import { DEFAULT_PAGE_SIZE, dateSchema, pageInput, pageOutput, platformOutput } from "@/lib/mcp/schemas";
import { appUrl, isoDay, platformShape, posterUrl } from "@/lib/mcp/shapes/common";
import { loadUserPlatformArrivals } from "@/lib/platform-arrivals-store";
import { previewFichaHref } from "@/lib/title-preview";

const DAY = 24 * 60 * 60 * 1000;

export const listPlatformArrivalsTool = defineTool({
  name: "list_platform_arrivals",
  title: "Llegó a tus plataformas",
  description:
    "Títulos del Quiero ver de la persona que acaban de llegar a una de sus plataformas en México (lo mismo que los avisos «Llegó a tu plataforma»), lo más reciente primero.",
  scope: "read",
  input: {
    days: z.number().int().min(1).max(30).optional().describe("Ventana en días hacia atrás (7 por defecto)."),
    ...pageInput,
  },
  output: {
    items: z
      .array(
        z.object({
          id: z.string().describe("Id del título en Filmia."),
          title: z.string().describe("Título."),
          platform: platformOutput.describe("Dónde llegó."),
          arrived_on: z.string().describe("Cuándo llegó (YYYY-MM-DD)."),
          url: z.string().describe("Ficha en Filmia."),
        }),
      )
      .describe("Llegadas de esta página."),
    ...pageOutput,
  },
  run: async ({ userId, now }, args) => {
    const days = args.days ?? 7;
    const arrivals = await loadUserPlatformArrivals(userId, now, days * DAY);
    const page = paginate(arrivals, queryKey("list_platform_arrivals", { days }), args.cursor, args.limit ?? DEFAULT_PAGE_SIZE);
    return {
      ...page,
      items: page.items.map((arrival) => ({
        id: arrival.catalogId,
        title: arrival.name,
        platform: platformShape(arrival.platform),
        arrived_on: isoDay(arrival.availableSince)!,
        url: appUrl(`/titulos/${arrival.titleId}`),
      })),
    };
  },
});

export const listCinemaTool = defineTool({
  name: "list_cinema",
  title: "Cartelera de cine",
  description:
    "La cartelera de cine en México: lo que está en salas (now) o lo que viene (upcoming, hasta una fecha). Incluye la fecha de estreno en México y si ya se puede ver en streaming.",
  scope: "read",
  input: {
    when: z.enum(["now", "upcoming"]).optional().describe("now (en cartelera, por defecto) o upcoming (próximos estrenos)."),
    until: dateSchema.optional().describe("Con upcoming: hasta esta fecha (YYYY-MM-DD); por defecto fin de año."),
    ...pageInput,
  },
  output: {
    items: z
      .array(
        z.object({
          id: z.string().describe("Id del título en Filmia."),
          title: z.string().describe("Título en México."),
          original_title: z.string().nullable().describe("Título original."),
          year: z.number().int().nullable().describe("Año."),
          mx_release_date: z.string().describe("Estreno en México (YYYY-MM-DD)."),
          status: z.string().describe("now, upcoming o gone."),
          streaming_on: z.array(platformOutput).describe("Si ya está incluida en alguna plataforma en México."),
          poster_url: z.string().nullable().describe("Póster."),
          url: z.string().describe("Ficha en Filmia."),
        }),
      )
      .describe("Películas de esta página."),
    ...pageOutput,
  },
  run: async (_ctx, args) => {
    const when = args.when ?? "now";
    const films = when === "now" ? await getNowShowing() : await getUpcoming(args.until);
    const page = paginate(films, queryKey("list_cinema", { when, until: args.until }), args.cursor, args.limit ?? DEFAULT_PAGE_SIZE);
    return {
      ...page,
      items: page.items.map((film) => ({
        id: film.catalogId,
        title: film.name,
        original_title: film.originalName && film.originalName !== film.name ? film.originalName : null,
        year: film.year,
        mx_release_date: film.mxReleaseDate,
        status: film.status,
        streaming_on: film.streaming.map(platformShape),
        poster_url: posterUrl(film.posterPath),
        url: appUrl(previewFichaHref("MOVIE", film.tmdbId)),
      })),
    };
  },
});
