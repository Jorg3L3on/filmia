import { ListsIcon, ProfileGroup, ProfileRow, ProfileSection } from "@/components/profile/ProfileRows";
import { partitionUserLists } from "@/lib/lists";
import { countPendingRequestsForOwner } from "@/lib/list-invites";
import { getLists } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

/** «Favoritas · 3 listas · Tus años» — what the Listas hub holds, in one line. */
export const listsRowSummary = (counts: { custom: number; years: number }) =>
  [
    "Favoritas",
    counts.custom > 0 ? `${counts.custom} ${counts.custom === 1 ? "lista" : "listas"}` : null,
    counts.years > 0 ? "Tus años" : null,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Perfil «Listas ›» (FIL-I17-3): Cine took the Listas tab, so the hub opens from here. Same
 * `/listas`, same routes; only the way in moved.
 */
export const ProfileListsRow = async () => {
  const userId = await requireUserId();
  const [lists, pending] = await Promise.all([getLists(), countPendingRequestsForOwner(userId)]);
  const { custom, years } = partitionUserLists(lists);
  const listsSummary = listsRowSummary({ custom: custom.length, years: years.length });
  // FIL-I18: someone asked to join one of your lists.
  const summary =
    pending > 0 ? `${pending} ${pending === 1 ? "solicitud" : "solicitudes"} · ${listsSummary}` : listsSummary;

  return (
    <ProfileSection id="listas" title="Listas">
      <ProfileGroup>
        <ProfileRow
          icon={<ListsIcon />}
          label="Listas"
          value={summary}
          href="/listas"
          ariaLabel={`Listas: ${summary}`}
        />
      </ProfileGroup>
    </ProfileSection>
  );
};
