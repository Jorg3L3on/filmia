"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type ConsentFormProps = {
  /** The authorization request as it came, re-validated by the server on POST. */
  request: Record<string, string>;
  clientName: string;
};

/**
 * Permitir / Cancelar for an MCP client. Posts JSON to /api/oauth/consent and navigates to the
 * `redirect_to` it answers: a form POST could not redirect off-site under `form-action 'self'`.
 * «Permitir cambios» starts unchecked; the server grants write only when it arrives true.
 */
export const ConsentForm = ({ request, clientName }: ConsentFormProps) => {
  const [allowWrite, setAllowWrite] = useState(false);
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (decision: "allow" | "deny") => {
    setPending(decision);
    setError(null);
    try {
      const response = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request, decision, allow_write: decision === "allow" && allowWrite }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        redirect_to?: string;
        error?: string;
        error_description?: string;
      };
      if (!response.ok || !payload.redirect_to) {
        setError(payload.error_description ?? payload.error ?? "No se pudo completar. Inténtalo otra vez.");
        setPending(null);
        return;
      }
      window.location.assign(payload.redirect_to);
    } catch {
      setError("No hay conexión. Inténtalo otra vez.");
      setPending(null);
    }
  };

  return (
    <div className="space-y-5">
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors duration-[var(--duration-hover)]",
          allowWrite ? "border-accent/60 bg-accent/[0.07]" : "border-line bg-well/60",
          "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        )}
      >
        <input
          type="checkbox"
          name="allow_write"
          checked={allowWrite}
          onChange={(event) => setAllowWrite(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
        />
        <span className="space-y-1">
          <span className="block text-[15px] font-medium text-paper">Permitir cambios</span>
          <span className="block text-sm leading-snug text-fog">
            Agregar a pendientes, marcar vistas, calificar y armar tus listas. Nunca borra títulos ni
            tu diario.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full"
          pending={pending === "allow"}
          pendingLabel="Conectando…"
          disabled={pending !== null}
          onClick={() => void submit("allow")}
        >
          Permitir a {clientName}
        </Button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void submit("deny")}
          className={cn(
            "h-11 w-full rounded-[var(--radius-button)] text-sm font-medium text-fog transition-colors hover:text-paper disabled:opacity-60",
            focusRing,
          )}
        >
          {pending === "deny" ? "Cancelando…" : "Cancelar"}
        </button>
      </div>
    </div>
  );
};
