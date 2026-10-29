"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { createInvite } from "@/app/actions/list-sharing";
import { Sheet, SheetHandle } from "@/components/Sheet";
import type { ListInviteKind, ListRole } from "@/db";
import { cn } from "@/lib/cn";
import {
  GROUP_MAX_USES_DEFAULT,
  GROUP_MAX_USES_MAX,
  GROUP_MAX_USES_MIN,
} from "@/lib/list-invite-limits";
import { showToast } from "@/lib/toast";
import { showActionError, TOAST_COPY } from "@/lib/toast-alerts";
import { SegmentActionTooltip, segmentActionCompactClass } from "@/components/SegmentAction";
import { ShareIcon } from "@/components/share/ShareButton";
import { focusRing } from "@/lib/ui";

const optionClass = (selected: boolean) =>
  cn(
    "press-scale flex w-full flex-col items-start rounded-2xl border px-4 py-3 text-left transition",
    selected ? "border-accent bg-accent/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
    focusRing,
  );

const Option = ({
  selected,
  onSelect,
  title,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) => (
  <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={optionClass(selected)}>
    <span className="text-[15px] font-semibold text-paper">{title}</span>
    <span className="text-xs text-fog">{hint}</span>
  </button>
);

const Block = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fog">{label}</p>
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {children}
    </div>
  </div>
);

/**
 * Canvas 1·2/1·3: two decisions (what they can do, who the link is for) and
 * WhatsApp. Every link ends in a request the owner approves. A personal link
 * is made per send; a group link is made once per sheet and reused.
 */
export const ShareListSheet = ({
  listId,
  listName,
  roles,
  publicShare,
  triggerLabel = "Compartir",
  compact = false,
}: {
  listId: string;
  listName: string;
  /** What this list can be shared as: Favoritas only VIEWER. */
  roles: ListRole[];
  /** The read-only public link that already existed (/compartir/lista), kept as is. */
  publicShare?: ReactNode;
  /** «Compartir» on the list; «Invitar a alguien más» in Miembros. */
  triggerLabel?: string;
  /** Round disc, same size as the other list actions. */
  compact?: boolean;
}) => {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ListRole>(roles.includes("EDITOR") ? "EDITOR" : "VIEWER");
  const [kind, setKind] = useState<ListInviteKind>("PERSONAL");
  const [maxUses, setMaxUses] = useState(GROUP_MAX_USES_DEFAULT);
  const [isPending, startTransition] = useTransition();
  const groupLink = useRef<{ key: string; url: Promise<string> } | null>(null);

  const linkUrl = (): Promise<string> => {
    const make = async () => {
      const result = await createInvite(listId, { kind, role, maxUses });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return new URL(result.path, window.location.origin).toString();
    };
    if (kind === "GROUP") {
      const key = `${role}:${maxUses}`;
      if (groupLink.current?.key !== key) {
        groupLink.current = { key, url: make() };
      }
      return groupLink.current.url;
    }
    return make();
  };

  const message = (url: string) =>
    `Te invito a mi lista «${listName}» en Filmia. ${role === "EDITOR" ? "Puedes agregar películas 🍿" : "Échale un ojo 🍿"} ${url}`;

  const fail = (caught: unknown) => {
    groupLink.current = null;
    showActionError({
      title: TOAST_COPY.couldNotCreateLink,
      description: caught instanceof Error && caught.message ? caught.message : "No se pudo crear el enlace.",
    });
  };

  const sendWhatsApp = () =>
    startTransition(async () => {
      try {
        const url = await linkUrl();
        window.location.href = `https://wa.me/?text=${encodeURIComponent(message(url))}`;
      } catch (caught) {
        fail(caught);
      }
    });

  const copy = () => {
    const url = linkUrl();
    startTransition(async () => {
      try {
        // Safari keeps the tap's permission only for a write started inside it.
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ "text/plain": url.then((value) => new Blob([value], { type: "text/plain" })) }),
          ]);
        } else {
          await navigator.clipboard.writeText(await url);
        }
        showToast({
          title: TOAST_COPY.linkCopied,
          description: kind === "PERSONAL" ? "Sirve una vez y vence en 7 días." : `Hasta ${maxUses} personas.`,
        });
      } catch (caught) {
        fail(caught);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        className={cn(
          compact
            ? segmentActionCompactClass
            : "press-scale inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-ink transition hover:bg-accent-hover",
          !compact && focusRing,
        )}
      >
        {compact ? (
          <>
            <ShareIcon className="size-5" />
            <SegmentActionTooltip label={triggerLabel} />
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M16 8a3 3 0 1 0-2.8-4M8 12a3 3 0 1 0 0 .01M16 16a3 3 0 1 0 0 .01M10.6 10.7l2.8-1.6M10.6 13.3l2.8 1.6" />
            </svg>
            {triggerLabel}
          </>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy={headingId} align="bottom" dragDismiss portal>
        <div className="space-y-5 px-5 pb-4 pt-3">
          <div className="flex flex-col items-center">
            <SheetHandle />
          </div>
          <div className="space-y-1">
            <h2 id={headingId} className="font-serif text-xl text-paper">
              Compartir «{listName}»
            </h2>
            <p className="text-sm text-fog">Cada persona te pide entrar y tú la apruebas.</p>
          </div>

          {roles.length > 1 ? (
            <Block label="Qué pueden hacer">
              <Option selected={role === "VIEWER"} onSelect={() => setRole("VIEWER")} title="Solo ver" hint="Ve la lista" />
              <Option selected={role === "EDITOR"} onSelect={() => setRole("EDITOR")} title="Puede editar" hint="Agrega y quita" />
            </Block>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-fog">
              Favoritas se comparte <strong className="text-paper">solo para ver</strong>.
            </p>
          )}

          <Block label="Tipo de link">
            <Option
              selected={kind === "PERSONAL"}
              onSelect={() => setKind("PERSONAL")}
              title="Para una persona"
              hint="Sirve una sola vez y vence en 7 días."
            />
            <Option
              selected={kind === "GROUP"}
              onSelect={() => setKind("GROUP")}
              title="Para un grupo"
              hint="Varias personas con el mismo link. Lo apagas cuando quieras."
            />
          </Block>

          {kind === "GROUP" ? (
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-sm text-paper">Máximo de personas</span>
              <span className="inline-flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Menos personas"
                  disabled={maxUses <= GROUP_MAX_USES_MIN}
                  onClick={() => setMaxUses((value) => Math.max(GROUP_MAX_USES_MIN, value - 1))}
                  className={cn("size-8 rounded-full bg-white/10 text-paper disabled:opacity-40", focusRing)}
                >
                  −
                </button>
                <span className="w-6 text-center text-base font-semibold tabular-nums text-paper" aria-live="polite">
                  {maxUses}
                </span>
                <button
                  type="button"
                  aria-label="Más personas"
                  disabled={maxUses >= GROUP_MAX_USES_MAX}
                  onClick={() => setMaxUses((value) => Math.min(GROUP_MAX_USES_MAX, value + 1))}
                  className={cn("size-8 rounded-full bg-white/10 text-paper disabled:opacity-40", focusRing)}
                >
                  +
                </button>
              </span>
            </div>
          ) : null}

          <div className="space-y-2">
            <button
              type="button"
              onClick={sendWhatsApp}
              disabled={isPending}
              className={cn(
                "press-scale flex h-12 w-full items-center justify-center rounded-full bg-[#25d366] text-base font-semibold text-[#06210f] disabled:opacity-70",
                focusRing,
              )}
            >
              Compartir por WhatsApp
            </button>
            <button
              type="button"
              onClick={copy}
              disabled={isPending}
              className={cn(
                "flex h-11 w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-sm font-semibold text-paper disabled:opacity-70",
                focusRing,
              )}
            >
              Copiar link
            </button>
          </div>
          {publicShare ? (
            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-fog">
              <span>¿Solo quieres enseñarla? Manda la vista pública, sin unirse.</span>
              {publicShare}
            </div>
          ) : null}
        </div>
      </Sheet>
    </>
  );
};
