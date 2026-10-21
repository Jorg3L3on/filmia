# Conector MCP de Filmia (FIL-I20)

Filmia como servidor MCP remoto: Claude, ChatGPT, Grok y Cursor pueden leer la biblioteca, Hoy,
recomendaciones, diario, listas, llegadas y cartelera de una persona y, si ella lo permite,
agregar a Quiero ver, marcar vistas, calificar y armar listas. La guía pública para personas vive
en `/conector` (es la `service_documentation` de la metadata OAuth); este documento es para quien
mantiene el código.

## Encender y apagar

| Variable | Valor | Efecto |
|---|---|---|
| `MCP_ENABLED` | `1` | Enciende `/api/mcp`, `/mcp`, `/api/oauth/*`, `/.well-known/oauth-*`, `/oauth/consent`, `/conector` y Perfil → Conexiones. |
| `MCP_ENABLED` | vacío u otro valor | Todo lo anterior responde 404 y el renglón de Perfil no aparece. |
| `AUTH_URL` | origen público, sin barra final | Issuer OAuth y URL del recurso (`<AUTH_URL>/api/mcp`). Nunca se usa el header `Host`. |

Migraciones (aditivas, antes del deploy): `0019_mcp_oauth.sql` (clientes, códigos, grants,
tokens personales, intentos de token) y `0020_mcp_activity.sql` (`McpToolCall`,
`McpIdempotencyKey`).

## URL y transporte

- URL del conector: `<AUTH_URL>/api/mcp` (alias `<AUTH_URL>/mcp`).
- Streamable HTTP sin estado (`mcp-handler` + `@modelcontextprotocol/server` 2.x), runtime Node,
  `maxDuration` 30 s. CORS solo para claude.ai, chatgpt.com, chat.openai.com, grok.com, el propio
  origen y localhost.
- Sin token: 401 con `WWW-Authenticate: Bearer … resource_metadata="<AUTH_URL>/.well-known/oauth-protected-resource"`.

## Cómo conectar cada cliente

| Cliente | Autenticación | Pasos |
|---|---|---|
| Claude | OAuth | Configuración → Conectores → Agregar conector personalizado → URL del conector → Conectar → aprobar en Filmia. |
| ChatGPT | OAuth (CIMD, aparece Verificado) | Configuración → Aplicaciones y conectores → modo desarrollador → crear conector con la URL y OAuth. |
| Grok | OAuth (DCR) | Conector personalizado (MCP remoto) con la URL; aprobar en Filmia. |
| Cursor | Token personal | Crear token en Perfil → Conexiones y en `~/.cursor/mcp.json`: `{"mcpServers":{"filmia":{"url":"<URL>","headers":{"Authorization":"Bearer <token>"}}}}`. |

## Servidor OAuth 2.1

Decisión fijada en Plania (5b952a3f) con las reglas tomadas de micasa (MIC-I5) y zigzag
(ZIG-I23-11). En resumen:

- Discovery: `/.well-known/oauth-protected-resource` (y `/api/mcp`, `/mcp`) y
  `/.well-known/oauth-authorization-server`.
- `/api/oauth/authorize` → `/oauth/consent` (detrás de la sesión) → `/api/oauth/token`,
  `/api/oauth/register` (DCR), `/api/oauth/revoke`.
- PKCE S256 obligatorio siempre; `private_key_jwt` no se ofrece y un `client_assertion` se ignora.
- Código de un solo uso (10 min); reusarlo revoca los grants que emitió.
- Audience RFC 8707: `resource` ausente = el MCP; otro → `invalid_target`; el token solo vale
  para `<AUTH_URL>/api/mcp`.
- **Access token 24 h; refresh token 365 días** desde cada rotación; reusar un refresh rotado
  revoca el grant.
- DCR: `https`, `http` solo en loopback, esquemas privados reverse-DNS; `client_uri`/`logo_uri`
  solo https; nombres que suplantan a ChatGPT/OpenAI/Claude/Anthropic/Grok/xAI/Cursor se
  rechazan; nombre recortado a 60.
- CIMD: https, sin IPs ni nombres privados, ≤ 64 KiB, 10 s, caché 24 h. Insignia «Verificado»
  solo para chatgpt.com / chat.openai.com.
- Consentimiento: host de regreso visible, «Permitir cambios» sin marcar (`write` solo con
  `allow_write: true`), POST solo desde el propio origen (Origin o `Sec-Fetch-Site`).
- Cambiar la contraseña revoca todos los grants y tokens personales.
- Retención (cron diario de watch-providers): intentos de token 30 días, códigos vencidos, grants
  muertos 90 días, clientes DCR sin uso 7 días, `McpToolCall` 90 días, idempotency keys 24 h.

## Límites

| Qué | Límite |
|---|---|
| `POST /api/oauth/token` | 30 por minuto por IP |
| `POST /api/oauth/register` | 10 por hora por IP |
| Resolver un CIMD nuevo | 20 por hora por IP |
| Llamadas a tools | 120 por minuto por conexión |
| Tokens personales nuevos | 10 por hora por cuenta |
| Tokens personales | 7, 30 o 90 días (máximo 365) |

## Herramientas (20)

Todas con `structuredContent` validado contra `outputSchema`, entrada estricta,
`openWorldHint: false`, la persona tomada de la conexión (ninguna recibe `user_id`).

| Tool | Scope | Notas |
|---|---|---|
| `whoami` | lectura | Primero. Persona, origen, scopes, `can_write`, plataformas. `_meta['openai/profile']`. |
| `get_tonight` | lectura | La selección de Hoy por lentes. |
| `recommend` | lectura | Filtros: plataformas, `max_runtime_min`, tipo, género. |
| `list_library` | lectura | pending / watching / watched / all; plataforma, tipo, orden; cursor. |
| `get_title` | lectura | Ficha con estado, calificación, dirección, reparto, premios y dónde verla en México. |
| `list_diary` | lectura | Rango o mes; cursor. |
| `list_lists` | lectura | Propias y compartidas con su rol; cursor. |
| `get_list` | lectura | Ítems y miembros (solo nombre y rol); ajena → `not_found`. |
| `get_watch_together` | lectura | «Qué vemos juntos» en una lista compartida (dueño o editora). |
| `list_platform_arrivals` | lectura | Lo que llegó a sus plataformas desde su Quiero ver. |
| `list_cinema` | lectura | Cartelera now / upcoming. |
| `search` | lectura | Forma de ChatGPT: biblioteca, listas, diario, TMDB (nunca OMDb). |
| `fetch` | lectura | `title:…`, `list:…`, `diary:YYYY-MM` → texto en español. |
| `add_to_library` | cambios | `idempotency_key`. |
| `set_title_status` | cambios | pending / not_pending / watching / finished / dropped / none. |
| `mark_seen` | cambios | Fecha, calificación, nota; `idempotency_key`; `confirm` si sobrescribe la calificación. |
| `rate_title` | cambios | `confirm` si sobrescribe la calificación. |
| `create_list` | cambios | `idempotency_key`. |
| `add_to_list` | cambios | `idempotency_key`; lectora → `forbidden`. |
| `remove_from_list` | cambios | `confirm: true` obligatorio. |

Prompts: `que_vemos_hoy`, `resumen_del_mes`, `lista_para`. Resources: `filmia://perfil`,
`filmia://listas/{id}`.

Regla de código: las tools (`src/lib/mcp/tools/*`) no consultan la base; llaman a las mismas
funciones de `src/lib` que la app (`queries.ts` `load*`, `title-writes.ts`, `list-writes.ts`,
`library.ts`, `title-detail.ts`, `tonight/recommend.ts`, `unified-search.ts`…). Un test lo
verifica.

## Errores

`{ "error": { "code", "message", "hint?", "candidates?", "retry_after_seconds?" } }` con
`isError: true`. Códigos: `unauthorized`, `forbidden`, `not_found`, `validation`, `rate_limited`,
`writes_disabled`, `confirmation_required`, `internal`. Cualquier otro error (base de datos
incluida) sale como `internal` y el detalle solo va al log.

## Revocar

Perfil → Conexiones: clientes conectados con su actividad (últimas 20 llamadas), «Desconectar»,
tokens personales con «Revocar». Revocar corta la siguiente llamada (401). Cambiar la contraseña
desconecta todo.

## Desarrollo y pruebas

- `npm test`: pruebas sin base (las que la necesitan se saltan).
- `npm run test:db:setup` y luego `npm run test:db`: también las de base, contra un Postgres
  local (`TEST_DATABASE_URL`, por defecto `postgresql://localhost:5432/filmia_test`). Nunca Neon.
- `FILMIA_LOCAL_PG=1` con un `DATABASE_URL` local hace que `npm run dev` hable con ese Postgres
  (protocolo HTTP de Neon servido por `src/db/local-pg.ts`).
- `scripts/mcp-dev-token.ts` crea un token personal en la base local para probar con curl o el
  MCP Inspector.
