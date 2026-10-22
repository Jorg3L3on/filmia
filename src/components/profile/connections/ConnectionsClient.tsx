"use client";

import { useState, useTransition } from "react";
import { createMcpToken, revokeMcpGrant, revokeMcpToken } from "@/app/actions/mcp";
import { Button } from "@/components/Button";
import { ChevronIcon } from "@/components/profile/ProfileRows";
import { cn } from "@/lib/cn";
import { relativeTimeEs } from "@/lib/relative-time";
import { TOOL_ERROR_LABEL, toolActivityLabel } from "@/lib/mcp/tool-labels";
import { showToast } from "@/lib/toast";
import { fieldClass, focusRing, glassRowClass } from "@/lib/ui";

/** Client pieces of Perfil → Conexiones (FIL-I20-6). Dates arrive as ISO strings. */

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const CopyIcon = () => (
  <svg {...iconProps} className="size-4">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

const KeyIcon = () => (
  <svg {...iconProps} className="size-5">
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 9-9M17 6l3 3M15 8l2 2" />
  </svg>
);

const copy = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value);
    showToast({ title: `${label} copiado`, variant: "success" });
  } catch {
    showToast({ title: "No se pudo copiar. Selecciónalo y cópialo a mano.", variant: "error" });
  }
};

/** The whole value, wrapped (FIL-I25-3): a URL you can read before you paste it. Copiar is 36 px in a 44 px box. */
export const CopyField = ({ value, label }: { value: string; label: string }) => (
  <div className="flex items-start gap-2 rounded-xl border border-chrome bg-well p-1 pl-3">
    <code className="min-w-0 flex-1 py-2 font-mono text-[13px] leading-[1.45] break-all text-paper">{value}</code>
    <button
      type="button"
      onClick={() => void copy(value, label)}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-chrome px-3 text-xs font-medium text-paper hover:bg-chrome-hover",
        focusRing,
      )}
    >
      <CopyIcon />
      Copiar
    </button>
  </div>
);

export type ActivityItem = { tool: string; ok: boolean; errorCode: string | null; at: string };

const Activity = ({ items, now }: { items: ActivityItem[]; now: string }) => {
  if (items.length === 0) {
    return <p className="text-xs text-mist">Todavía no ha hecho nada.</p>;
  }
  return (
    <ol className="space-y-1.5">
      {items.map((item, index) => (
        <li key={`${item.at}-${index}`} className="flex items-baseline gap-2 text-[13px]">
          <span
            aria-hidden="true"
            className={cn("mt-1 size-1.5 shrink-0 rounded-full", item.ok ? "bg-success" : "bg-danger")}
          />
          <span className="min-w-0 flex-1 text-fog">
            {toolActivityLabel(item.tool)}
            {!item.ok && item.errorCode ? (
              <span className="text-danger"> · {TOOL_ERROR_LABEL[item.errorCode] ?? item.errorCode}</span>
            ) : null}
          </span>
          <span className="shrink-0 text-xs text-mist">{relativeTimeEs(item.at, new Date(now))}</span>
        </li>
      ))}
    </ol>
  );
};

const Badge = ({ tone, children }: { tone: "success" | "muted" | "accent"; children: string }) => (
  <span
    className={cn(
      "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
      tone === "success" && "bg-success-well text-success",
      tone === "accent" && "bg-accent/15 text-accent",
      tone === "muted" && "border border-line text-mist",
    )}
  >
    {children}
  </span>
);

type ConnectionCardProps = {
  kind: "client" | "token";
  id: string;
  name: string;
  subtitle: string;
  verified?: boolean;
  canWrite: boolean;
  lastUsed: string | null;
  lastWhoami: string | null;
  activity: ActivityItem[];
  now: string;
};

/** One connected app or personal token: who, what it may do, what it did, Revocar. */
export const ConnectionCard = ({
  kind,
  id,
  name,
  subtitle,
  verified,
  canWrite,
  lastUsed,
  lastWhoami,
  activity,
  now,
}: ConnectionCardProps) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const initial = Array.from(name)[0]?.toUpperCase() ?? "?";

  const revoke = () => {
    const what = kind === "client" ? `Desconectar ${name}` : `Revocar el token «${name}»`;
    if (!window.confirm(`${what}? Deja de funcionar de inmediato.`)) return;
    startTransition(async () => {
      const result = kind === "client" ? await revokeMcpGrant(id) : await revokeMcpToken(id);
      showToast(
        result.ok
          ? { title: kind === "client" ? `${name} desconectada` : "Token revocado", variant: "success" }
          : { title: "Ya no estaba activa.", variant: "error" },
      );
    });
  };

  return (
    <li className={cn(glassRowClass, "px-4 pt-4 pb-1", pending && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chrome font-serif text-lg text-paper"
        >
          {kind === "token" ? <KeyIcon /> : initial}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[15px] font-medium text-paper">{name}</p>
          <p className="truncate text-xs text-mist">{subtitle}</p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {kind === "client" ? (
              <Badge tone={verified ? "success" : "muted"}>{verified ? "Verificado" : "No verificado"}</Badge>
            ) : null}
            <Badge tone={canWrite ? "accent" : "muted"}>{canWrite ? "Puede hacer cambios" : "Solo lectura"}</Badge>
          </div>
        </div>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-mist">Último uso</dt>
          <dd className="text-fog">{lastUsed ? relativeTimeEs(lastUsed, new Date(now)) : "Nunca"}</dd>
        </div>
        <div>
          <dt className="text-mist">Última identificación</dt>
          <dd className="text-fog">{lastWhoami ? relativeTimeEs(lastWhoami, new Date(now)) : "—"}</dd>
        </div>
      </dl>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/80 pt-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn("-ml-1 flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left text-sm text-fog hover:text-paper", focusRing)}
        >
          Actividad ({activity.length})
          <ChevronIcon className={cn("size-4 shrink-0 text-faint transition-transform duration-[var(--duration-hover)]", open && "rotate-90")} />
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          aria-busy={pending || undefined}
          className={cn(
            "relative inline-flex h-9 shrink-0 items-center rounded-[var(--radius-button)] px-3 text-sm font-medium text-danger hover:bg-danger-well disabled:opacity-60",
            "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
            focusRing,
          )}
        >
          {kind === "client" ? "Desconectar" : "Revocar"}
        </button>
      </div>
      {open ? (
        <div className="mt-1 pb-3">
          <Activity items={activity} now={now} />
        </div>
      ) : null}
    </li>
  );
};

const LIFETIMES = [7, 30, 90] as const;

/**
 * «+ Nuevo token» (FIL-I25-3): folded behind one dashed button once a token exists, so the
 * form does not weigh as much as the tokens; open from the start when there are none.
 */
export const NewTokenDisclosure = ({ defaultOpen }: { defaultOpen: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  if (open) {
    return <NewTokenForm onDone={defaultOpen ? undefined : () => setOpen(false)} />;
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-expanded={false}
      className={cn(
        "flex h-11 w-full items-center justify-center rounded-xl border border-dashed border-white/20 text-sm font-medium text-accent hover:border-accent/50 hover:bg-accent/[0.04]",
        focusRing,
      )}
    >
      + Nuevo token
    </button>
  );
};

/** Nueva clave: name, lifetime, «Permitir cambios»; the token is shown once. */
const NewTokenForm = ({ onDone }: { onDone?: () => void }) => {
  const [name, setName] = useState("Cursor");
  const [days, setDays] = useState<(typeof LIFETIMES)[number]>(30);
  const [allowWrite, setAllowWrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string; expiresAt: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createMcpToken({ name, days, allowWrite });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated({ token: result.token, expiresAt: result.expiresAt });
    });
  };

  if (created) {
    return (
      <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/[0.06] p-4">
        <p className="text-[15px] font-medium text-paper">Copia tu token ahora</p>
        <p className="text-sm text-fog">No lo volveremos a mostrar. Pégalo en Cursor como Bearer token.</p>
        <CopyField value={created.token} label="Token" />
        <p className="text-xs text-mist">
          Vence el{" "}
          {new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" }).format(
            new Date(created.expiresAt),
          )}
          .
        </p>
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            setCreated(null);
            onDone?.();
          }}
        >
          Listo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn(glassRowClass, "space-y-4 p-4")}>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-fog">Nombre</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          required
          className={fieldClass}
          placeholder="Cursor"
        />
      </label>
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium uppercase tracking-wide text-fog">Vence en</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-chrome bg-well p-1">
          {LIFETIMES.map((value) => (
            <label
              key={value}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                days === value ? "bg-chrome font-medium text-paper" : "text-fog hover:text-paper",
              )}
            >
              <input
                type="radio"
                name="days"
                value={value}
                checked={days === value}
                onChange={() => setDays(value)}
                className="sr-only"
              />
              {value} días
            </label>
          ))}
        </div>
      </fieldset>
      {/* The whole row is the target (FIL-I25-3), not the 20 px box. */}
      <label className="-mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.03]">
        <input
          type="checkbox"
          checked={allowWrite}
          onChange={(event) => setAllowWrite(event.target.checked)}
          className="size-5 shrink-0 accent-[var(--accent)]"
        />
        <span className="space-y-0.5">
          <span className="block text-[15px] text-paper">Permitir cambios</span>
          <span className="block text-xs text-mist">Agregar, marcar vistas, calificar y armar listas.</span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" pending={pending} pendingLabel="Creando…">
        Crear token
      </Button>
    </form>
  );
};
