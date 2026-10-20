import { z } from "zod";
import { mxToday } from "@/lib/cine-core";
import { isoDateToUtcNoon } from "@/lib/dates";
import { resolveTitleRef, loadOwnTitle, type ResolvedTitle } from "@/lib/library";
import { addTitleToListFor, createListFor, removeFromListFor } from "@/lib/list-writes";
import { defineTool, type ToolContext } from "@/lib/mcp/define-tool";
import { McpToolError, notFound } from "@/lib/mcp/errors";
import { withIdempotency } from "@/lib/mcp/idempotency";
import { confirmSchema, dateSchema, idempotencyKeySchema, titleRefSchema } from "@/lib/mcp/schemas";
import { appUrl } from "@/lib/mcp/shapes/common";
import { fichaUrl } from "@/lib/mcp/shapes/title";
import {
  addToWatchlistFor,
  ensureOwnTitleFor,
  markWatchedFor,
  removeFromWatchlistFor,
  setRatingFor,
  setSeriesStatusFor,
} from "@/lib/title-writes";

/**
 * Write tools (FIL-I20-5), only for connections with «Permitir cambios». Each one calls the same
 * src/lib function as the app's Server Action. Tools that create rows take an idempotency_key;
 * removing from a list or overwriting a rating needs confirm: true.
 */

const titleResult = z
  .object({
    id: z.string().describe("Id del título en Filmia."),
    title: z.string().describe("Título."),
    url: z.string().describe("Ficha en Filmia."),
  })
  .describe("El título afectado.");

const listIdSchema = z.string().min(10).max(40).regex(/^[a-z0-9]+$/).describe("Id de la lista (de list_lists).");

const resolveOrThrow = async (userId: string, ref: string) => {
  const resolved = await resolveTitleRef(userId, ref);
  if (!resolved) throw notFound("ese título", "Usa search para obtener su id.");
  return resolved;
};

/** The person's Title id for the film, creating the entry (no state) if they never saved it. */
const ownTitleId = async (userId: string, resolved: ResolvedTitle) => {
  if (resolved.titleId) return { titleId: resolved.titleId, created: false };
  return ensureOwnTitleFor(userId, resolved.catalog);
};

const summary = (resolved: ResolvedTitle, titleId: string | null) => ({
  id: resolved.catalog.id,
  title: resolved.catalog.name,
  url: fichaUrl({ titleId, tmdbId: resolved.catalog.tmdbId, kind: resolved.catalog.kind }),
});

const idempotent = <T>(ctx: ToolContext, tool: string, args: Record<string, unknown> & { idempotency_key: string }, run: () => Promise<T>) =>
  withIdempotency(ctx.deps.idempotency, { userId: ctx.userId, key: args.idempotency_key, tool, args, now: ctx.now }, run);

export const addToLibraryTool = defineTool({
  name: "add_to_library",
  title: "Agregar a Quiero ver",
  description:
    "Agrega un título a la biblioteca de la persona: a su Quiero ver (pending, por defecto) o, si es serie, como «viendo» (watching). Si ya estaba, no lo duplica.",
  scope: "write",
  annotations: { idempotentHint: true },
  input: {
    id: titleRefSchema,
    status: z.enum(["pending", "watching"]).optional().describe("pending (Quiero ver) o watching (serie en curso)."),
    note: z.string().max(200).optional().describe("Nota para su Quiero ver, por ejemplo «la recomendó Ana»."),
    idempotency_key: idempotencyKeySchema,
  },
  output: {
    title: titleResult,
    status: z.enum(["pending", "watching"]).describe("Dónde quedó."),
    newly_added: z.boolean().describe("false si ya estaba ahí."),
  },
  run: async (ctx, args) =>
    idempotent(ctx, "add_to_library", args, async () => {
      const resolved = await resolveOrThrow(ctx.userId, args.id);
      const status = args.status ?? "pending";
      if (status === "watching" && resolved.catalog.kind !== "SERIES") {
        throw new McpToolError("validation", "«watching» solo aplica a series.", { hint: "Usa pending para películas." });
      }
      const { titleId, created } = await ownTitleId(ctx.userId, resolved);
      let added = created;
      if (status === "pending") {
        added = (await addToWatchlistFor(ctx.userId, titleId, args.note)).added || created;
      } else {
        await setSeriesStatusFor(ctx.userId, titleId, "WATCHING");
      }
      return { title: summary(resolved, titleId), status, newly_added: added };
    }),
});

export const setTitleStatusTool = defineTool({
  name: "set_title_status",
  title: "Cambiar el estado",
  description:
    "Cambia el estado de un título de la persona: pending (a Quiero ver), not_pending (sacarlo de Quiero ver) o, en series, watching, finished, dropped o none. No borra el título ni su diario.",
  scope: "write",
  annotations: { destructiveHint: true, idempotentHint: true },
  input: {
    id: titleRefSchema,
    status: z
      .enum(["pending", "not_pending", "watching", "finished", "dropped", "none"])
      .describe("Nuevo estado; watching/finished/dropped/none son de series."),
  },
  output: { title: titleResult, status: z.string().describe("Estado aplicado.") },
  run: async ({ userId }, args) => {
    const resolved = await resolveOrThrow(userId, args.id);
    const { titleId } = await ownTitleId(userId, resolved);
    if (args.status === "pending") await addToWatchlistFor(userId, titleId);
    else if (args.status === "not_pending") await removeFromWatchlistFor(userId, titleId);
    else {
      const series = { watching: "WATCHING", finished: "FINISHED", dropped: "DROPPED", none: null } as const;
      await setSeriesStatusFor(userId, titleId, series[args.status]);
    }
    return { title: summary(resolved, titleId), status: args.status };
  },
});

const ratingSchema = z.number().int().min(1).max(10).describe("Calificación de 1 a 10 (2 = una estrella, 10 = cinco).");

/** Overwriting a different rating the person already gave needs their explicit OK. */
const guardRatingOverwrite = (existing: number | null | undefined, next: number | undefined, confirm: boolean | undefined) => {
  if (next === undefined || existing == null || existing === next || confirm) return;
  throw new McpToolError("confirmation_required", `Ya tenía calificación ${existing}/10; cambiarla a ${next} sobrescribe la anterior.`, {
    hint: "Pregúntale a la persona y repite con confirm: true.",
  });
};

export const markSeenTool = defineTool({
  name: "mark_seen",
  title: "Marcar como vista",
  description:
    "Registra que la persona vio un título en una fecha (hoy por defecto, hora de México), con calificación y nota opcionales, y lo saca de su Quiero ver. Si ya tenía otra calificación, pide confirm: true.",
  scope: "write",
  annotations: { destructiveHint: true },
  input: {
    id: titleRefSchema,
    watched_on: dateSchema.optional().describe("Día en que la vio (YYYY-MM-DD); hoy por defecto."),
    rating: ratingSchema.optional(),
    note: z.string().max(2000).optional().describe("Reseña o nota de la persona."),
    confirm: confirmSchema.optional(),
    idempotency_key: idempotencyKeySchema,
  },
  output: {
    title: titleResult,
    watched_on: z.string().describe("Fecha registrada."),
    rating: z.number().int().nullable().describe("Calificación guardada."),
  },
  run: async (ctx, args) =>
    idempotent(ctx, "mark_seen", args, async () => {
      const resolved = await resolveOrThrow(ctx.userId, args.id);
      const own = await loadOwnTitle(ctx.userId, resolved);
      guardRatingOverwrite(own?.rating, args.rating, args.confirm);
      const watchedOn = args.watched_on ?? mxToday(ctx.now);
      if (watchedOn > mxToday(ctx.now)) {
        throw new McpToolError("validation", "La fecha no puede ser futura.");
      }
      const { titleId } = await ownTitleId(ctx.userId, resolved);
      await markWatchedFor(ctx.userId, titleId, {
        watchedAt: isoDateToUtcNoon(watchedOn),
        ...(args.rating !== undefined ? { rating: args.rating } : {}),
        ...(args.note !== undefined ? { review: args.note.trim() || null } : {}),
      });
      return {
        title: summary(resolved, titleId),
        watched_on: watchedOn,
        rating: args.rating ?? own?.rating ?? null,
      };
    }),
});

export const rateTitleTool = defineTool({
  name: "rate_title",
  title: "Calificar",
  description:
    "Califica un título (1 a 10) y opcionalmente guarda una reseña. Si la persona ya tenía otra calificación, pide confirm: true antes de sobrescribirla.",
  scope: "write",
  annotations: { destructiveHint: true, idempotentHint: true },
  input: {
    id: titleRefSchema,
    rating: ratingSchema,
    review: z.string().max(2000).optional().describe("Reseña de la persona."),
    confirm: confirmSchema.optional(),
  },
  output: { title: titleResult, rating: z.number().int().describe("Calificación guardada.") },
  run: async ({ userId }, args) => {
    const resolved = await resolveOrThrow(userId, args.id);
    const own = await loadOwnTitle(userId, resolved);
    guardRatingOverwrite(own?.rating, args.rating, args.confirm);
    const { titleId } = await ownTitleId(userId, resolved);
    await setRatingFor(userId, titleId, {
      rating: args.rating,
      ...(args.review !== undefined ? { review: args.review.trim() || null } : {}),
    });
    return { title: summary(resolved, titleId), rating: args.rating };
  },
});

export const createListTool = defineTool({
  name: "create_list",
  title: "Crear una lista",
  description: "Crea una lista propia de la persona (como «Domingo» o «Para ver con papá»). El nombre no puede repetir uno que ya tenga.",
  scope: "write",
  input: {
    name: z.string().min(1).max(60).describe("Nombre de la lista."),
    description: z.string().max(300).optional().describe("Descripción opcional."),
    idempotency_key: idempotencyKeySchema,
  },
  output: {
    list: z
      .object({ id: z.string().describe("Id de la lista."), name: z.string().describe("Nombre."), url: z.string().describe("La lista en Filmia.") })
      .describe("La lista creada."),
  },
  run: async (ctx, args) =>
    idempotent(ctx, "create_list", args, async () => {
      const created = await createListFor(ctx.userId, { name: args.name, description: args.description });
      return { list: { id: created.listId, name: created.name, url: appUrl(`/listas/${created.listId}`) } };
    }),
});

export const addToListTool = defineTool({
  name: "add_to_list",
  title: "Agregar a una lista",
  description:
    "Agrega un título a una lista propia o compartida donde la persona es editora (una lectora recibe forbidden). Si la persona no tenía el título, lo guarda en su biblioteca sin estado.",
  scope: "write",
  annotations: { idempotentHint: true },
  input: { list_id: listIdSchema, id: titleRefSchema, idempotency_key: idempotencyKeySchema },
  output: {
    title: titleResult,
    list: z.object({ id: z.string().describe("Id."), name: z.string().describe("Nombre.") }).describe("La lista."),
    newly_added: z.boolean().describe("false si ya estaba en la lista."),
  },
  run: async (ctx, args) =>
    idempotent(ctx, "add_to_list", args, async () => {
      const resolved = await resolveOrThrow(ctx.userId, args.id);
      const { titleId } = await ownTitleId(ctx.userId, resolved);
      const result = await addTitleToListFor(ctx.userId, args.list_id, titleId);
      return {
        title: summary(resolved, titleId),
        list: { id: result.list.id, name: result.list.name },
        newly_added: result.added,
      };
    }),
});

export const removeFromListTool = defineTool({
  name: "remove_from_list",
  title: "Quitar de una lista",
  description:
    "Quita un título de una lista donde la persona puede editar. No borra el título de su biblioteca ni su diario. Pide confirm: true después de que la persona lo apruebe.",
  scope: "write",
  annotations: { destructiveHint: true, idempotentHint: true },
  input: { list_id: listIdSchema, id: titleRefSchema, confirm: confirmSchema.optional() },
  output: {
    list: z.object({ id: z.string().describe("Id."), name: z.string().describe("Nombre.") }).describe("La lista."),
    removed: z.boolean().describe("false si no estaba en la lista."),
  },
  run: async ({ userId }, args) => {
    if (args.confirm !== true) {
      throw new McpToolError("confirmation_required", "Quitar de una lista necesita confirmación.", {
        hint: "Pregúntale a la persona y repite con confirm: true.",
      });
    }
    const resolved = await resolveOrThrow(userId, args.id);
    // On a shared list the film may not be in their library: the catalog id names it there.
    const result = await removeFromListFor(userId, args.list_id, resolved.titleId ?? resolved.catalog.id);
    return { list: { id: result.list.id, name: result.list.name }, removed: result.removed };
  },
});

export const writeTools = [
  addToLibraryTool,
  setTitleStatusTool,
  markSeenTool,
  rateTitleTool,
  createListTool,
  addToListTool,
  removeFromListTool,
];
