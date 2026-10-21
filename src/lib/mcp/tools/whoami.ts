import { z } from "zod";
import { todayDateInput } from "@/lib/dates";
import { defineTool } from "@/lib/mcp/define-tool";
import { notFound } from "@/lib/mcp/errors";
import { platformOutput } from "@/lib/mcp/schemas";
import { platformShape } from "@/lib/mcp/shapes/common";
import { loadUserProfile } from "@/lib/queries";

/** The entry point: who this connection acts for and what it may do. */
export const whoamiTool = defineTool({
  name: "whoami",
  title: "Quién soy en Filmia",
  description:
    "Llámala primero. Dice a nombre de quién actúa esta conexión, qué puede hacer (solo leer, o también cambiar) y sus plataformas de streaming en México. Fechas y horarios de Filmia son de la Ciudad de México.",
  scope: "read",
  input: {},
  output: {
    user: z
      .object({
        name: z.string().nullable().describe("Nombre visible de la persona (sin correo)."),
      })
      .describe("La persona dueña de esta conexión."),
    connection: z
      .object({
        source: z.enum(["oauth", "personal_token"]).describe("Cómo se conectó el cliente."),
        client_name: z.string().describe("Nombre del cliente o del token."),
        scopes: z.array(z.enum(["read", "write"])).describe("Permisos de la conexión."),
        can_write: z.boolean().describe("true si la persona permitió cambios (agregar, marcar vistas, listas)."),
        expires_at: z.string().describe("Cuándo vence la credencial actual (ISO 8601)."),
      })
      .describe("La conexión que hace esta llamada."),
    platforms: z.array(platformOutput).describe("Plataformas de streaming que la persona tiene en México."),
    timezone: z.string().describe("Zona horaria de las fechas de Filmia."),
    today: z.string().describe("Hoy en la Ciudad de México (YYYY-MM-DD)."),
  },
  meta: { "openai/profile": true },
  run: async ({ userId, connection, now }) => {
    const profile = await loadUserProfile(userId);
    if (!profile) throw notFound("tu cuenta");
    return {
      user: { name: profile.name },
      connection: {
        source: connection.source,
        client_name: connection.clientName,
        scopes: connection.scopes,
        can_write: connection.canWrite,
        expires_at: connection.expiresAt.toISOString(),
      },
      platforms: profile.streamingPlatforms.map(platformShape),
      timezone: "America/Mexico_City",
      today: todayDateInput(now),
    };
  },
});
