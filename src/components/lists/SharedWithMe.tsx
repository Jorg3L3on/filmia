import type { CSSProperties } from "react";
import { ListCard, listCardGridClass } from "@/components/ListCard";
import { AvatarStack, PersonAvatar } from "@/components/lists/PersonAvatar";
import { DecideButtons, MyRequestButton } from "@/components/lists/RequestControls";
import type { getPendingRequestsForOwner, getSharedWithMe } from "@/lib/list-invites";
import { personFirstName } from "@/lib/person-avatar";

type SharedWithMe = Awaited<ReturnType<typeof getSharedWithMe>>;
type OwnerRequests = Awaited<ReturnType<typeof getPendingRequestsForOwner>>;

export const roleLabel = (role: "EDITOR" | "VIEWER") => (role === "EDITOR" ? "puedes editar" : "solo ver");

/** Canvas 4·1: lists other people shared with you, and your requests still open. */
export const SharedWithMeSection = ({ shared }: { shared: SharedWithMe }) => {
  if (shared.lists.length === 0 && shared.requests.length === 0) {
    return null;
  }
  return (
    <section className="space-y-4 pt-2">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-paper">
        <span className="text-affinity" aria-hidden="true">
          ◎
        </span>
        Compartidas conmigo
      </h2>
      {shared.requests.length > 0 ? (
        <ul className="space-y-2">
          {shared.requests.map((request) => (
            <li
              key={request.id}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-paper">{request.listName}</span>
                <span className="block text-xs text-fog">
                  {request.status === "PENDING"
                    ? `De ${personFirstName(request.ownerName)} · esperando aprobación`
                    : "No se pudo unirte a esta lista"}
                </span>
              </span>
              {request.status === "PENDING" ? (
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                  En espera
                </span>
              ) : null}
              <MyRequestButton requestId={request.id} kind={request.status === "PENDING" ? "cancel" : "dismiss"} />
            </li>
          ))}
        </ul>
      ) : null}
      {shared.lists.length > 0 ? (
        <ul className={listCardGridClass}>
          {shared.lists.map((list, index) => (
            <li key={list.id} className="min-w-0 stagger-in" style={{ "--stagger": index } as CSSProperties}>
              <ListCard
                href={`/listas/${list.id}`}
                name={list.name}
                itemCount={list.total}
                posters={list.posters}
                layout="grid"
                subtitle={`De ${personFirstName(list.ownerName)} · ${roleLabel(list.role)}`}
                badge={<PersonAvatar person={{ id: list.ownerId, name: list.ownerName }} size={28} />}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

/** Canvas 3·1 on Listas: one request is settled here; several open Miembros. */
export const OwnerRequestsNotice = ({ requests }: { requests: OwnerRequests }) => {
  if (requests.length === 0) {
    return null;
  }
  const byList = new Map<string, OwnerRequests>();
  for (const request of requests) {
    byList.set(request.listId, [...(byList.get(request.listId) ?? []), request]);
  }
  return (
    <ul className="space-y-2" aria-label="Solicitudes para unirse">
      {[...byList.values()].map((group) => {
        const first = group[0]!;
        const single = group.length === 1;
        return (
          <li
            key={first.listId}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.07] px-4 py-3"
          >
            <AvatarStack people={group.map((request) => ({ id: request.userId, name: request.name }))} />
            <span className="min-w-0 flex-1 text-sm text-paper">
              {single ? (
                <>
                  <strong>{personFirstName(first.name)}</strong> quiere unirse a «{first.listName}» ·{" "}
                  <span className="text-fog">{first.role === "EDITOR" ? "Puede editar" : "Solo ver"}</span>
                </>
              ) : (
                <>
                  {group.length} personas quieren unirse a «{first.listName}»
                </>
              )}
            </span>
            {single ? (
              <DecideButtons listId={first.listId} requestIds={[first.id]} names={personFirstName(first.name)} />
            ) : (
              <a
                href={`/listas/${first.listId}/miembros#solicitudes`}
                className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-ink"
              >
                Ver solicitudes
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
};
