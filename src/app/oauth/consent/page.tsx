import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";
import { ConsentForm } from "@/components/oauth/ConsentForm";
import { clientTrust } from "@/lib/mcp-oauth/clients";
import { isMcpEnabled } from "@/lib/mcp-oauth/config";
import { oauthHttpDeps } from "@/lib/mcp-oauth/deps";
import { checkConsentRequest } from "@/lib/mcp-oauth/http";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conectar una app",
  robots: { index: false },
} as const;

type ConsentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const FORWARDED = ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "resource"];

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const READS: { icon: ReactNode; label: string }[] = [
  {
    icon: (
      <svg {...iconProps}>
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
      </svg>
    ),
    label: "Lo de Hoy y tus recomendaciones",
  },
  {
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
    label: "Tu biblioteca, tu diario y tus listas, también las compartidas contigo",
  },
  {
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="m10 9.5 4.5 2.5-4.5 2.5z" />
      </svg>
    ),
    label: "Lo que llega a tus plataformas y la cartelera de cine",
  },
];

/**
 * «¿Conectar Claude con tu Filmia?» (FIL-I20-1). Behind the Filmia session (the proxy sends
 * signed-out people to /login and back here). Shows who asks, where the answer goes, what it
 * can read, and «Permitir cambios» unchecked.
 */
export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  if (!isMcpEnabled()) notFound();
  const user = await requireUser();
  const params = await searchParams;
  const raw = Object.fromEntries(
    FORWARDED.flatMap((name) => (typeof params[name] === "string" ? [[name, params[name] as string]] : [])),
  );
  const check = await checkConsentRequest(oauthHttpDeps, raw);

  if (!check.ok) {
    return (
      <AuthScreen title="No se puede conectar" eyebrow="CONECTAR UNA APP">
        <p className="text-center text-[15px] leading-relaxed text-fog">{check.message}</p>
        <p className="text-center text-sm text-mist">Vuelve a la app e inténtalo de nuevo.</p>
      </AuthScreen>
    );
  }

  const { client } = check;
  const trust = clientTrust(client, check.request.redirect_uri);
  const initial = Array.from(client.clientName)[0]?.toUpperCase() ?? "?";

  return (
    <AuthScreen title={`¿Conectar ${client.clientName}?`} eyebrow="CONECTAR UNA APP">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-well/60 p-3.5">
        {/* Initial, never the client's logo_uri: third-party images are outside img-src. */}
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-chrome font-serif text-xl text-paper"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[15px] font-medium text-paper">{client.clientName}</p>
          {trust.verified ? (
            <span className="inline-block rounded-full bg-success-well px-2 py-0.5 text-[11px] font-medium text-success">
              Verificado
            </span>
          ) : (
            <span className="inline-block rounded-full border border-line px-2 py-0.5 text-[11px] text-mist">
              No verificado
            </span>
          )}
          <p className="break-all text-xs text-mist">
            Regresa a <span className="text-fog">{trust.redirectHost}</span>
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-fog">Podrá ver</p>
        <ul className="space-y-2.5">
          {READS.map((item) => (
            <li key={item.label} className="flex items-start gap-3 text-[15px] leading-snug text-paper">
              <span className="mt-px flex size-7 shrink-0 items-center justify-center rounded-lg bg-chrome [&_svg]:size-4">
                {item.icon}
              </span>
              <span className="pt-0.5">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <ConsentForm request={raw} clientName={client.clientName} />

      <p className="text-center text-xs leading-relaxed text-mist">
        Entraste como <span className="text-fog">{user.email}</span>. Puedes desconectarla cuando quieras en
        Perfil → Conexiones; si cambias tu contraseña, se desconecta sola.
      </p>
    </AuthScreen>
  );
}
