import { ListsIcon, ProfileRow } from "@/components/profile/ProfileRows";
import { partitionUserLists } from "@/lib/lists";
import { countPendingRequestsForOwner } from "@/lib/list-invites";
import { getLists } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

const counted = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);

/** «3 diarias · 3 tuyas · Tus años» (FIL-I25-1): what the Listas hub holds, counted, in one line. */
export const listsRowSummary = (counts: { fixed: number; custom: number; years: number }) =>
  [
    counted(counts.fixed, "diaria", "diarias"),
    counted(counts.custom, "tuya", "tuyas"),
    counts.years > 0 ? "Tus años" : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Crea tu primera lista";

/**
 * Perfil «Listas ›» (FIL-I17-3): Cine took the Listas tab, so the hub opens from here. Same
 * `/listas`, same routes; only the way in moved. A row of «Tu Filmia» (FIL-I25-2).
 */
export const ProfileListsRow = async () => {
  const userId = await requireUserId();
  const [lists, pending] = await Promise.all([getLists(), countPendingRequestsForOwner(userId)]);
  const { fixed, custom, years } = partitionUserLists(lists);
  const listsSummary = listsRowSummary({ fixed: fixed.length, custom: custom.length, years: years.length });
  // FIL-I18: someone asked to join one of your lists.
  const summary =
    pending > 0 ? `${pending} ${pending === 1 ? "solicitud" : "solicitudes"} · ${listsSummary}` : listsSummary;

  return <ProfileRow icon={<ListsIcon />} label="Listas" value={summary} href="/listas" ariaLabel={`Listas: ${summary}`} />;
};
