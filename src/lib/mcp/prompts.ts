import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * One-click flows for clients that show prompts (Claude, Cursor) (FIL-I20-8). Each one tells
 * the model which tools to use; the data still comes from the tools.
 */

const text = (body: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: body } }] });

export const PROMPTS = {
  que_vemos_hoy: {
    title: "¿Qué vemos hoy?",
    description: "Elige qué ver esta noche con Filmia, opcionalmente en una plataforma y con una duración máxima.",
    args: z.object({
      plataforma: z.string().max(30).optional().describe("Plataforma, por ejemplo Netflix."),
      duracion_max: z.string().max(10).optional().describe("Minutos como máximo, por ejemplo 120."),
    }),
    render: (args: { plataforma?: string; duracion_max?: string }) =>
      text(
        [
          "¿Qué vemos hoy? Usa Filmia:",
          "1. Llama whoami para saber mis plataformas.",
          `2. Llama recommend${args.plataforma ? ` con la plataforma ${args.plataforma}` : ""}${
            args.duracion_max ? ` y max_runtime_min ${args.duracion_max}` : ""
          } (y get_tonight si quieres ver mi selección de Hoy).`,
          "3. Propónme tres opciones con una línea de por qué cada una y dónde verla.",
        ].join("\n"),
      ),
  },
  resumen_del_mes: {
    title: "Resumen del mes",
    description: "Un resumen de lo que viste en un mes: títulos, calificaciones y lo mejor.",
    args: z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe("Mes en formato YYYY-MM.") }),
    render: (args: { mes: string }) =>
      text(
        [
          `Haz un resumen de mi mes ${args.mes} en Filmia:`,
          `1. Llama list_diary con month ${args.mes} (sigue next_cursor hasta el final).`,
          "2. Dime cuántas películas y series vi, cuál califiqué mejor y cuál peor, y qué géneros dominaron.",
          "3. Cierra con una recomendación para el mes siguiente usando recommend.",
        ].join("\n"),
      ),
  },
  lista_para: {
    title: "Arma una lista",
    description: "Arma una lista de Filmia para una ocasión (por ejemplo «el fin con mis papás»).",
    args: z.object({ ocasion: z.string().min(2).max(80).describe("Para qué es la lista.") }),
    render: (args: { ocasion: string }) =>
      text(
        [
          `Arma una lista en Filmia para: ${args.ocasion}.`,
          "1. Usa whoami, recommend y list_library (status pending) para encontrar 5 a 8 títulos que encajen.",
          "2. Enséñamelos y espera mi visto bueno.",
          "3. Con mi OK, crea la lista con create_list y agrega cada título con add_to_list (cada llamada con su idempotency_key).",
        ].join("\n"),
      ),
  },
} as const;

export const registerFilmiaPrompts = (server: McpServer) => {
  for (const [name, prompt] of Object.entries(PROMPTS)) {
    server.registerPrompt(
      name,
      { title: prompt.title, description: prompt.description, argsSchema: prompt.args },
      ((args: never) => prompt.render(args)) as never,
    );
  }
};
