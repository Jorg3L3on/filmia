import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ProfileBodySkeleton } from "@/components/PageSkeletons";
import { ProfileSection } from "@/components/profile/ProfileRows";
import { ConnectionCard, CopyField, NewTokenDisclosure } from "@/components/profile/connections/ConnectionsClient";
import { CLIENT_GUIDES, fillGuide, guideAuthLabel } from "@/lib/mcp/client-guides";
import { loadMcpConnections } from "@/lib/mcp/connections";
import { getMcpResourceUrl, isMcpEnabled, MCP_SERVICE_DOCUMENTATION_PATH } from "@/lib/mcp-oauth/config";
import { requireUserId } from "@/lib/session";
import { cn } from "@/lib/cn";
import { focusRing, glassRowClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Conexiones" } as const;

const dateEs = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });
const day = (value: Date) => dateEs.format(value).replace(".", "");

/**
 * Perfil → Conexiones (FIL-I20-6): the connector URL, the apps connected by OAuth and the
 * personal tokens, with what each one did and a way to cut it.
 */
export default function ConnectionsPage() {
  if (!isMcpEnabled()) notFound();
  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-8">
      <PageHeader
        title="Conexiones"
        description="Usa Filmia desde Claude, ChatGPT, Grok o Cursor."
        backHref="/perfil"
        backLabel="Volver a Perfil"
      />
      <Suspense fallback={<ProfileBodySkeleton />}>
        <ConnectionsBody />
      </Suspense>
    </div>
  );
}

const ConnectionsBody = async () => {
  const userId = await requireUserId();
  const now = new Date();
  const { clients, personal } = await loadMcpConnections(userId, now);
  const url = getMcpResourceUrl();
  const nowIso = now.toISOString();

  return (
    <div className="space-y-9">
      <ProfileSection id="url" title="Tu conector">
        <div className={cn(glassRowClass, "space-y-3 p-4")}>
          <p className="text-sm text-fog">Pega esta URL en tu app. Te pedirá entrar a Filmia y aprobar.</p>
          <CopyField value={url} label="URL" />
          <a
            href={MCP_SERVICE_DOCUMENTATION_PATH}
            className={cn("-my-1 flex min-h-11 items-center text-sm text-accent hover:text-accent-hover", focusRing)}
          >
            Guía completa del conector →
          </a>
        </div>
      </ProfileSection>

      <ProfileSection id="apps" title="Apps conectadas" aside={clients.length ? String(clients.length) : undefined}>
        {clients.length === 0 ? (
          <p className="text-sm text-mist">Ninguna todavía. Conecta una con la URL de arriba.</p>
        ) : (
          <ul className="space-y-3">
            {clients.map((client) => (
              <ConnectionCard
                key={client.id}
                kind="client"
                id={client.id}
                name={client.name}
                subtitle={[client.host, `desde el ${day(client.since)}`].filter(Boolean).join(" · ")}
                verified={client.verified}
                canWrite={client.canWrite}
                lastUsed={client.lastUsedAt?.toISOString() ?? null}
                lastWhoami={client.lastWhoamiAt?.toISOString() ?? null}
                activity={client.activity.map((item) => ({ ...item, at: item.at.toISOString() }))}
                now={nowIso}
              />
            ))}
          </ul>
        )}
      </ProfileSection>

      <ProfileSection id="tokens" title="Tokens personales" aside={personal.length ? String(personal.length) : undefined}>
        <p className="text-sm text-mist">Para apps como Cursor, que no piden tu cuenta.</p>
        {personal.length > 0 ? (
          <ul className="space-y-3">
            {personal.map((token) => (
              <ConnectionCard
                key={token.id}
                kind="token"
                id={token.id}
                name={token.name}
                subtitle={`${token.prefix}… · vence el ${day(token.expiresAt)}`}
                canWrite={token.canWrite}
                lastUsed={token.lastUsedAt?.toISOString() ?? null}
                lastWhoami={token.lastWhoamiAt?.toISOString() ?? null}
                activity={token.activity.map((item) => ({ ...item, at: item.at.toISOString() }))}
                now={nowIso}
              />
            ))}
          </ul>
        ) : null}
        <NewTokenDisclosure defaultOpen={personal.length === 0} />
      </ProfileSection>

      <ProfileSection id="como" title="Cómo conectar">
        <ul className="space-y-3">
          {CLIENT_GUIDES.map((guide) => (
            <li key={guide.id} className={cn(glassRowClass, "p-0")}>
              <details className="group">
                <summary
                  className={cn(
                    "flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] text-paper",
                    focusRing,
                  )}
                >
                  <span>
                    {guide.name}
                    <span className="ml-2 text-xs text-mist">
                      {guideAuthLabel(guide)}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-faint transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-8 text-sm leading-relaxed text-fog">
                  {guide.steps.map((step) => (
                    <li key={step}>{fillGuide(step, url)}</li>
                  ))}
                </ol>
                {guide.snippet ? (
                  <pre className="mx-4 mb-4 overflow-x-auto rounded-xl bg-well p-3 font-mono text-xs text-paper">
                    {fillGuide(guide.snippet, url)}
                  </pre>
                ) : null}
              </details>
            </li>
          ))}
        </ul>
      </ProfileSection>
    </div>
  );
};
