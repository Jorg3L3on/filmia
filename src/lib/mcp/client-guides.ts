/**
 * How to connect each client (FIL-I20-7), shared by Perfil → Conexiones and the public guide
 * (/conector). `{url}` is replaced by the connector URL.
 */
export type ClientGuide = {
  id: "claude" | "chatgpt" | "grok" | "cursor";
  name: string;
  auth: "oauth" | "token";
  steps: string[];
  snippet?: string;
};

export const CLIENT_GUIDES: ClientGuide[] = [
  {
    id: "claude",
    name: "Claude",
    auth: "oauth",
    steps: [
      "En claude.ai abre Configuración → Conectores → Agregar conector personalizado.",
      "Nombre: Filmia. URL: {url}",
      "Pulsa Conectar, entra a Filmia si te lo pide y aprueba en la pantalla de Filmia.",
      "Activa Filmia en el chat (menú de herramientas) y pregunta «¿qué vemos hoy?».",
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    auth: "oauth",
    steps: [
      "En ChatGPT abre Configuración → Aplicaciones y conectores → Configuración avanzada y activa el modo desarrollador.",
      "Crea un conector con la URL {url} y autenticación OAuth.",
      "Aprueba en la pantalla de Filmia; ChatGPT aparece como Verificado.",
      "En un chat nuevo elige Filmia en las herramientas del modo desarrollador.",
    ],
  },
  {
    id: "grok",
    name: "Grok",
    auth: "oauth",
    steps: [
      "En Grok agrega un conector personalizado (servidor MCP remoto).",
      "URL: {url}. Grok descubre el inicio de sesión de Filmia solo.",
      "Aprueba en la pantalla de Filmia y vuelve a Grok.",
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    auth: "token",
    steps: [
      "Crea abajo un token personal (7, 30 o 90 días) y cópialo: solo se muestra una vez.",
      "En Cursor abre Settings → MCP → Add new MCP server, o edita ~/.cursor/mcp.json:",
    ],
    snippet: `{
  "mcpServers": {
    "filmia": {
      "url": "{url}",
      "headers": { "Authorization": "Bearer <tu token>" }
    }
  }
}`,
  },
];

export const fillGuide = (text: string, url: string) => text.replaceAll("{url}", url);
