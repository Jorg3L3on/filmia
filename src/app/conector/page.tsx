import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { CLIENT_GUIDES, fillGuide } from "@/lib/mcp/client-guides";
import { toolAnnotations } from "@/lib/mcp/define-tool";
import { MCP_ERROR_CODES } from "@/lib/mcp/errors";
import { mcpToolDefinitions } from "@/lib/mcp/server";
import { getMcpResourceUrl, isMcpEnabled } from "@/lib/mcp-oauth/config";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { eyebrowClass, focusRing, glassRowClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conector de Filmia",
  description: "Usa Filmia desde Claude, ChatGPT, Grok o Cursor.",
} as const;

const ERROR_TEXT: Record<(typeof MCP_ERROR_CODES)[number], string> = {
  unauthorized: "La conexión ya no es válida (vencida o revocada). Vuelve a conectar.",
  forbidden: "La persona no tiene permiso, por ejemplo agregar a una lista donde solo lee.",
  not_found: "No existe o no es de la persona (las listas ajenas no compartidas responden esto).",
  validation: "Argumentos inválidos, cursor de otra consulta o idempotency_key reutilizada para otra acción.",
  rate_limited: "Demasiadas llamadas seguidas; trae retry_after_seconds.",
  writes_disabled: "La conexión no tiene «Permitir cambios».",
  confirmation_required: "Falta confirm: true para quitar de una lista o sobrescribir una calificación.",
  internal: "Falló algo de nuestro lado; el detalle solo queda en nuestros registros.",
};

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} aria-labelledby={`${id}-h`} className="space-y-3">
    <h2 id={`${id}-h`} className="font-serif text-[1.375rem] leading-tight text-paper">
      {title}
    </h2>
    {children}
  </section>
);

/**
 * Public guide to the MCP connector (FIL-I20-7): the `service_documentation` the OAuth metadata
 * advertises. No session needed.
 */
export default function ConnectorGuidePage() {
  if (!isMcpEnabled()) notFound();
  const url = getMcpResourceUrl();
  const tools = mcpToolDefinitions();

  return (
    <main className="mx-auto w-full min-w-0 max-w-2xl space-y-10 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-16">
      <header className="space-y-4">
        <Logo size="lg" />
        <p className={eyebrowClass}>Conector MCP</p>
        <h1 className="font-serif text-4xl tracking-tight text-paper">Filmia en tu asistente</h1>
        <p className="text-[15px] leading-relaxed text-fog">
          Pregúntale a Claude, ChatGPT, Grok o Cursor qué ver hoy, si ya tienes una película, dónde verla en México o qué
          viste este mes. Con tu permiso también puede agregar a Quiero ver, marcar vistas, calificar y armar listas.
        </p>
        <div className={cn(glassRowClass, "space-y-2 p-4")}>
          <p className="text-xs font-medium uppercase tracking-wide text-fog">URL del conector</p>
          <code className="block break-all font-mono text-sm text-paper">{url}</code>
        </div>
      </header>

      <Section id="conectar" title="Cómo conectar">
        <ul className="space-y-3">
          {CLIENT_GUIDES.map((guide) => (
            <li key={guide.id} className={cn(glassRowClass, "space-y-2 p-4")}>
              <p className="text-[15px] font-medium text-paper">
                {guide.name}{" "}
                <span className="text-xs font-normal text-mist">
                  {guide.auth === "oauth" ? "· inicio de sesión OAuth" : "· token personal"}
                </span>
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-fog">
                {guide.steps.map((step) => (
                  <li key={step}>{fillGuide(step, url)}</li>
                ))}
              </ol>
              {guide.snippet ? (
                <pre className="overflow-x-auto rounded-xl bg-well p-3 font-mono text-xs text-paper">
                  {fillGuide(guide.snippet, url)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm text-fog">
          Al conectar verás una pantalla de Filmia que dice qué app pide acceso y a dónde regresa. «Permitir cambios» empieza
          sin marcar: sin él la app solo puede leer.
        </p>
      </Section>

      <Section id="herramientas" title={`Qué puede hacer (${tools.length} herramientas)`}>
        <ul className={cn(glassRowClass, "divide-y divide-line/80")}>
          {tools.map((tool) => {
            const annotations = toolAnnotations(tool);
            return (
              <li key={tool.name} className="space-y-1 px-4 py-3">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <code className="font-mono text-sm text-paper">{tool.name}</code>
                  <span className="text-xs text-mist">{tool.scope === "read" ? "lectura" : "cambios"}</span>
                  {annotations.destructiveHint ? <span className="text-xs text-danger">sobrescribe o quita</span> : null}
                </p>
                <p className="text-sm leading-relaxed text-fog">{tool.description}</p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-fog">
          También hay prompts (<code>que_vemos_hoy</code>, <code>resumen_del_mes</code>, <code>lista_para</code>) y los
          recursos <code>filmia://perfil</code> y <code>filmia://listas/{"{id}"}</code> para las apps que los muestran.
        </p>
      </Section>

      <Section id="errores" title="Errores">
        <ul className="space-y-2 text-sm text-fog">
          {MCP_ERROR_CODES.map((code) => (
            <li key={code}>
              <code className="font-mono text-paper">{code}</code>: {ERROR_TEXT[code]}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="limites" title="Límites y seguridad">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fog">
          <li>Token de acceso OAuth: 24 h. La app lo renueva sola con el refresh token, que dura 365 días desde cada uso.</li>
          <li>Tokens personales: 7, 30 o 90 días (máximo 365). Se muestran una sola vez; Filmia solo guarda un hash.</li>
          <li>
            {RATE_LIMITS.mcpConnection.limit} llamadas por minuto por conexión; {RATE_LIMITS.personalTokenAccount.limit} tokens
            personales nuevos por hora.
          </li>
          <li>PKCE obligatorio; cada código de autorización sirve una vez; un refresh token reutilizado desconecta la app.</li>
          <li>Las escrituras que crean algo piden idempotency_key: reintentar no duplica nada durante 24 h.</li>
          <li>Ninguna herramienta borra títulos, entradas del diario ni listas completas.</li>
        </ul>
      </Section>

      <Section id="revocar" title="Cómo desconectar">
        <p className="text-sm leading-relaxed text-fog">
          En{" "}
          <Link href="/perfil/conexiones" className={cn("text-accent hover:text-accent-hover", focusRing)}>
            Perfil → Conexiones
          </Link>{" "}
          ves qué apps están conectadas, qué hizo cada una y puedes desconectarlas o revocar tokens. Cambiar tu contraseña
          desconecta todas.
        </p>
      </Section>
    </main>
  );
}
