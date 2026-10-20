import { notFound } from "next/navigation";
import { NavLabel } from "@/components/NavOriginTracker";
import { PageHeader } from "@/components/PageHeader";
import { MemberCompatSection } from "@/components/lists/MemberCompatSection";
import { MembersPanel } from "@/components/lists/MembersPanel";
import { PersonAvatar } from "@/components/lists/PersonAvatar";
import { DecideButtons } from "@/components/lists/RequestControls";
import { ShareListSheet } from "@/components/lists/ShareListSheet";
import { loadMemberCompat } from "@/lib/compat-store";
import { canWatchTogether } from "@/lib/group-access";
import { getListAccess } from "@/lib/list-access";
import { shareableRoles } from "@/lib/list-access-core";
import { getListInvites, getListPeople, getPendingRequests } from "@/lib/list-invites";
import { personFirstName } from "@/lib/person-avatar";
import { relativeTimeEs } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

export const metadata = { title: "Miembros" } as const;

/**
 * `/listas/[id]/miembros` (FIL-I18-4, canvas 3·2 and 6·1–6·4): who is on the
 * list and who can still get in. Only the owner sees requests and links.
 */
export default async function ListMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getListAccess(id);
  if (!access) {
    notFound();
  }
  const { list, role, userId } = access;
  const isOwner = role === "OWNER";
  const [people, requests, invites] = await Promise.all([
    getListPeople(id),
    isOwner ? getPendingRequests(id) : Promise.resolve([]),
    isOwner ? getListInvites(id) : Promise.resolve([]),
  ]);
  const roles = shareableRoles(list);
  const ownerName = people.find((person) => person.role === "OWNER")?.name ?? null;
  // «% de compatibilidad» (FIL-I19-4): same lists and people as «Qué vemos juntos».
  const compat = canWatchTogether(list, role, people) ? await loadMemberCompat(list.id, userId, people) : null;
  const viewerFullName = people.find((person) => person.id === userId)?.name ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-8 py-2">
      <NavLabel label={`Listas · ${list.name} · Miembros`} />
      <PageHeader
        title="Miembros"
        description={`«${list.name}»`}
        backHref={`/listas/${list.id}`}
        backLabel={list.name}
      />

      {requests.length > 0 ? (
        <section id="solicitudes" className="scroll-mt-20 space-y-3" aria-labelledby="solicitudes-title">
          <h2 id="solicitudes-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-fog">
            Solicitudes
          </h2>
          <p className="text-sm text-fog">
            {requests.length === 1 ? "1 persona quiere" : `${requests.length} personas quieren`} unirse. Entran con el rol
            del link que usaron.
          </p>
          <ul className="divide-y divide-white/[0.06] rounded-3xl border border-accent/25 bg-accent/[0.05]">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <PersonAvatar person={{ id: request.userId, name: request.name }} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-paper">
                    {request.name?.trim() || "Sin nombre"}
                  </span>
                  <span className="block text-xs text-fog">
                    {request.role === "EDITOR" ? "Puede editar" : "Solo ver"} · {relativeTimeEs(request.createdAt)}
                  </span>
                </span>
                <DecideButtons listId={list.id} requestIds={[request.id]} names={personFirstName(request.name)} />
              </li>
            ))}
          </ul>
          {requests.length > 1 ? (
            <div className="flex justify-end">
              <DecideButtons
                listId={list.id}
                requestIds={requests.map((request) => request.id)}
                approveLabel={`Aprobar a los ${requests.length}`}
                rejectLabel="Rechazar todos"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <MembersPanel
        listId={list.id}
        listName={list.name}
        viewerId={userId}
        isOwner={isOwner}
        roles={roles}
        ownerFirstName={personFirstName(ownerName)}
        people={people.map((person) => ({
          ...person,
          joinedAt: person.joinedAt ? person.joinedAt.toISOString() : null,
        }))}
        invites={invites.map((invite) => ({
          id: invite.id,
          kind: invite.kind,
          role: invite.role,
          maxUses: invite.maxUses,
          usedCount: invite.usedCount,
          expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
          status: invite.status,
        }))}
      />

      {compat ? <MemberCompatSection compat={compat} viewer={{ id: userId, name: personFirstName(viewerFullName), fullName: viewerFullName }} /> : null}

      {isOwner && roles.length > 0 ? (
        <div className="flex justify-center">
          <ShareListSheet listId={list.id} listName={list.name} roles={roles} triggerLabel="Invitar a alguien más" />
        </div>
      ) : null}
    </div>
  );
}
