"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { changeMemberRole, leaveList, removeListMember, toggleInvite } from "@/app/actions/list-sharing";
import { PersonAvatar } from "@/components/lists/PersonAvatar";
import { Sheet, SheetHandle } from "@/components/Sheet";
import type { ListRole } from "@/db";
import { cn } from "@/lib/cn";
import { personFirstName } from "@/lib/person-avatar";
import { relativeTimeEs } from "@/lib/relative-time";
import { reportLeaveFailure, reportMemberChangeFailure } from "@/lib/alert-retry";
import { showToast } from "@/lib/toast";
import { TOAST_COPY } from "@/lib/toast-alerts";
import { focusRing } from "@/lib/ui";

export type PanelPerson = {
  id: string;
  name: string | null;
  role: "OWNER" | ListRole;
  joinedAt: string | null;
  added: number;
};

export type PanelInvite = {
  id: string;
  kind: "PERSONAL" | "GROUP";
  role: ListRole;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  status: "active" | "off" | "used" | "expired";
};

const ROLE_LABEL: Record<PanelPerson["role"], string> = {
  OWNER: "Dueño",
  EDITOR: "Puede editar",
  VIEWER: "Solo ver",
};

const rowClass = "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left";
const dangerClass = cn(
  "press-scale flex h-12 w-full items-center justify-center rounded-full border border-danger-line bg-danger-well text-base font-semibold text-danger",
  focusRing,
);
const quietClass = cn(
  "flex h-11 w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-sm font-semibold text-paper",
  focusRing,
);

const daysLeft = (expiresAt: string) => {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  return days <= 1 ? "vence hoy" : `vence en ${days} días`;
};

/**
 * Canvas 6·1–6·4. The owner changes a role with one tap (no «Guardar»), takes
 * someone out after confirming (their films stay), and switches links off;
 * anyone else can leave. Nothing shows for what a role cannot do.
 */
export const MembersPanel = ({
  listId,
  listName,
  viewerId,
  isOwner,
  roles,
  people,
  invites,
  ownerFirstName,
}: {
  listId: string;
  listName: string;
  viewerId: string;
  isOwner: boolean;
  /** Roles this list can hand out (Favoritas: only VIEWER). */
  roles: ListRole[];
  people: PanelPerson[];
  invites: PanelInvite[];
  ownerFirstName: string;
}) => {
  const router = useRouter();
  const headingId = useId();
  const [selected, setSelected] = useState<PanelPerson | null>(null);
  const [confirm, setConfirm] = useState<"remove" | "leave" | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<unknown>, done: string, after?: () => void) =>
    startTransition(async () => {
      try {
        await action();
        showToast({ title: done });
        after?.();
        router.refresh();
      } catch (caught) {
        reportMemberChangeFailure(caught, async () => {
          await action();
          showToast({ title: done });
          after?.();
          router.refresh();
        });
      }
    });

  const liveInvites = invites.filter((invite) => invite.status === "active" || (invite.kind === "GROUP" && invite.status === "off"));

  return (
    <div className="space-y-8">
      <section className="space-y-2" aria-labelledby="miembros-title">
        <h2 id="miembros-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-fog">
          Miembros
        </h2>
        <ul className="divide-y divide-white/[0.06] rounded-3xl border border-white/10 bg-white/[0.03]">
          {people.map((person) => {
            const you = person.id === viewerId;
            const tappable = isOwner && person.role !== "OWNER";
            const body = (
              <>
                <PersonAvatar person={person} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-paper">
                    {person.name?.trim() || "Sin nombre"}
                    {you ? <span className="font-normal text-fog"> (tú)</span> : null}
                  </span>
                  <span className="block text-xs text-fog">
                    {person.role === "OWNER"
                      ? "Creó la lista"
                      : person.joinedAt
                        ? `Se unió ${relativeTimeEs(person.joinedAt)}`
                        : ""}
                  </span>
                </span>
                <span className="text-xs font-semibold text-paper/80">{ROLE_LABEL[person.role]}</span>
                {tappable ? <span aria-hidden="true" className="text-fog">›</span> : null}
              </>
            );
            return (
              <li key={person.id}>
                {tappable ? (
                  <button type="button" onClick={() => setSelected(person)} className={cn(rowClass, "hover:bg-white/[0.04]", focusRing)}>
                    {body}
                  </button>
                ) : (
                  <div className={rowClass}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner && liveInvites.length > 0 ? (
        <section className="space-y-2" aria-labelledby="links-title">
          <h2 id="links-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-fog">
            Links activos
          </h2>
          <ul className="divide-y divide-white/[0.06] rounded-3xl border border-white/10 bg-white/[0.03]">
            {liveInvites.map((invite) => (
              <li key={invite.id} className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-paper">
                    {invite.kind === "GROUP" ? "Link de grupo" : "Para una persona"}
                  </span>
                  <span className="block text-xs text-fog">
                    {ROLE_LABEL[invite.role]} ·{" "}
                    {invite.kind === "GROUP"
                      ? `${invite.usedCount} de ${invite.maxUses} lugares`
                      : invite.expiresAt
                        ? daysLeft(invite.expiresAt)
                        : ""}
                    {invite.status === "off" ? " · apagado" : ""}
                  </span>
                </span>
                {invite.kind === "GROUP" ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={invite.status === "active"}
                    aria-label={invite.status === "active" ? "Apagar el link" : "Prender el link"}
                    disabled={isPending}
                    onClick={() =>
                      run(
                        () => toggleInvite(listId, invite.id, invite.status === "active"),
                        invite.status === "active" ? TOAST_COPY.linkOff : TOAST_COPY.linkOn,
                      )
                    }
                    className={cn(
                      "relative h-7 w-12 rounded-full transition-colors",
                      invite.status === "active" ? "bg-accent" : "bg-white/15",
                      focusRing,
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]",
                        invite.status === "active" ? "left-[1.375rem]" : "left-0.5",
                      )}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => toggleInvite(listId, invite.id, true), TOAST_COPY.linkRevoked)}
                    className={cn("text-sm font-semibold text-danger", focusRing)}
                  >
                    Revocar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isOwner ? null : (
        <button type="button" onClick={() => setConfirm("leave")} className={dangerClass}>
          Salir de la lista
        </button>
      )}

      {/* 6·2: change the role (applies on tap) or take the person out. */}
      <Sheet open={Boolean(selected) && confirm == null} onClose={() => setSelected(null)} labelledBy={headingId} align="bottom" dragDismiss portal>
        {selected ? (
          <div className="space-y-4 px-5 pb-4 pt-3">
            <div className="flex flex-col items-center">
              <SheetHandle />
            </div>
            <div className="flex items-center gap-3">
              <PersonAvatar person={selected} size={44} />
              <div>
                <h2 id={headingId} className="font-serif text-xl text-paper">
                  {selected.name?.trim() || "Sin nombre"}
                </h2>
                <p className="text-xs text-fog">
                  {selected.joinedAt ? `Se unió ${relativeTimeEs(selected.joinedAt)}` : ""} · agregó {selected.added}{" "}
                  {selected.added === 1 ? "película" : "películas"}
                </p>
              </div>
            </div>
            <div role="radiogroup" aria-label="Rol" className="space-y-2">
              {(["EDITOR", "VIEWER"] as const)
                .filter((role) => roles.includes(role) || selected.role === role)
                .map((role) => (
                  <button
                    key={role}
                    type="button"
                    role="radio"
                    aria-checked={selected.role === role}
                    disabled={isPending || !roles.includes(role)}
                    onClick={() => {
                      if (selected.role === role) {
                        return;
                      }
                      run(
                        () => changeMemberRole(listId, selected.id, role),
                        `${personFirstName(selected.name)} ahora ${role === "EDITOR" ? "puede editar" : "solo ve"}`,
                        () => setSelected({ ...selected, role }),
                      );
                    }}
                    className={cn(
                      "flex w-full flex-col items-start rounded-2xl border px-4 py-3 text-left",
                      selected.role === role ? "border-accent bg-accent/10" : "border-white/10 bg-white/[0.04]",
                      focusRing,
                    )}
                  >
                    <span className="text-[15px] font-semibold text-paper">{ROLE_LABEL[role]}</span>
                    <span className="text-xs text-fog">
                      {role === "EDITOR" ? "Agrega y quita películas." : "Ve la lista y quién agregó qué. No cambia nada."}
                    </span>
                  </button>
                ))}
            </div>
            <button type="button" onClick={() => setConfirm("remove")} className={cn(dangerClass, "mt-2")}>
              Sacar de la lista
            </button>
          </div>
        ) : null}
      </Sheet>

      {/* 6·3 / 6·4: destructive and social, so it asks and says the name. */}
      <Sheet open={confirm != null} onClose={() => setConfirm(null)} label="Confirmar" align="center" portal>
        <div className="space-y-4 px-5 py-5 text-center">
          {confirm === "remove" && selected ? (
            <>
              <h2 className="font-serif text-xl text-paper">
                ¿Sacar a {personFirstName(selected.name)} de «{listName}»?
              </h2>
              <p className="text-sm text-fog">
                Ya no podrá verla ni editarla.{" "}
                {selected.added > 0
                  ? `Las ${selected.added === 1 ? "película" : `${selected.added} películas`} que agregó se quedan en la lista.`
                  : ""}
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() => removeListMember(listId, selected.id), `${personFirstName(selected.name)} ya no está en la lista`, () => {
                    setConfirm(null);
                    setSelected(null);
                  })
                }
                className={dangerClass}
              >
                Sacar a {personFirstName(selected.name)}
              </button>
            </>
          ) : confirm === "leave" ? (
            <>
              <h2 className="font-serif text-xl text-paper">¿Salir de «{listName}»?</h2>
              <p className="text-sm text-fog">
                Dejarás de verla en Compartidas conmigo. Para volver, {ownerFirstName} tendría que invitarte otra vez.
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await leaveList(listId);
                      showToast({ title: TOAST_COPY.leftList });
                      router.replace("/listas");
                    } catch {
                      reportLeaveFailure();
                    }
                  })
                }
                className={dangerClass}
              >
                Salir de la lista
              </button>
            </>
          ) : null}
          <button type="button" onClick={() => setConfirm(null)} className={quietClass}>
            {confirm === "leave" ? "Quedarme" : "Cancelar"}
          </button>
        </div>
      </Sheet>
    </div>
  );
};
