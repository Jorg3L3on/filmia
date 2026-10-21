import { ResourceNotFoundError, ResourceTemplate, type McpServer, type ServerContext } from "@modelcontextprotocol/server";
import { PLATFORM_LABEL } from "@/lib/labels";
import { listAccessFor } from "@/lib/list-access";
import { getListPeople, getSharedWithMe } from "@/lib/list-invites";
import { listFetchText } from "@/lib/mcp/shapes/fetch";
import type { McpConnection } from "@/lib/mcp-oauth/service";
import { loadListById, loadLists } from "@/lib/queries";
import { loadTasteProfile } from "@/lib/taste-profile";

/**
 * Resources (FIL-I20-8): `filmia://perfil` (taste and platforms, nothing personal beyond that)
 * and `filmia://listas/{id}` for lists the person owns or that are shared with them.
 */

const ROLE = { OWNER: "dueño", EDITOR: "editor", VIEWER: "lector" } as const;

const connectionOf = (ctx: ServerContext): McpConnection => {
  const connection = (ctx.http?.authInfo?.extra as { connection?: McpConnection } | undefined)?.connection;
  if (!connection) throw new ResourceNotFoundError("filmia://", "Sin conexión válida.");
  return connection;
};

const json = (uri: URL, value: unknown) => ({
  contents: [{ uri: uri.toString(), mimeType: "application/json", text: JSON.stringify(value) }],
});

export const registerFilmiaResources = (server: McpServer) => {
  server.registerResource(
    "perfil",
    "filmia://perfil",
    {
      title: "Perfil de gustos",
      description: "Plataformas de la persona en México, géneros y directores de lo que más le gustó.",
      mimeType: "application/json",
    },
    async (uri, ctx) => {
      const { userId } = connectionOf(ctx);
      const profile = await loadTasteProfile(userId);
      return json(uri, {
        platforms: profile.platforms.map((platform) => ({ id: platform, name: PLATFORM_LABEL[platform] })),
        watched_count: profile.watchedCount,
        favorite_genres: profile.favoriteGenres,
        favorite_directors: profile.favoriteDirectors,
      });
    },
  );

  server.registerResource(
    "lista",
    new ResourceTemplate("filmia://listas/{id}", {
      list: async (ctx) => {
        const { userId } = connectionOf(ctx);
        const [own, shared] = await Promise.all([loadLists(userId), getSharedWithMe(userId)]);
        return {
          resources: [
            ...own.map((list) => ({ uri: `filmia://listas/${list.id}`, name: list.name, mimeType: "text/plain" })),
            ...shared.lists.map((list) => ({
              uri: `filmia://listas/${list.id}`,
              name: `${list.name} (de ${list.ownerName ?? "alguien"})`,
              mimeType: "text/plain",
            })),
          ],
        };
      },
    }),
    { title: "Lista de Filmia", description: "Una lista propia o compartida con la persona, en texto.", mimeType: "text/plain" },
    async (uri, variables, ctx) => {
      const { userId } = connectionOf(ctx);
      const id = String(variables.id ?? "");
      const access = /^[a-z0-9]{10,40}$/.test(id) ? await listAccessFor(id, userId) : null;
      const list = access ? await loadListById(userId, id) : undefined;
      if (!list) throw new ResourceNotFoundError(uri.toString(), "No encontré esa lista.");
      const people = await getListPeople(list.id);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/plain",
            text: listFetchText({
              name: list.name,
              role: ROLE[list.role],
              members: people.map((person) => ({ name: person.name, role: ROLE[person.role] })),
              items: list.items.map((item) => ({ name: item.title.name, year: item.title.year })),
            }),
          },
        ],
      };
    },
  );
};
