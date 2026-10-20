import type { ListKind, ListRole } from "@/db";
import { FAVORITAS_SLUG, isFixedListSlug } from "@/lib/lists";

/**
 * Who can do what on a list (FIL-I18). The owner is `List.userId`; everyone
 * else reaches a list only through a `ListMember` row with a role.
 */
export type ListAccessRole = "OWNER" | ListRole;

const RANK: Record<ListAccessRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export const roleAtLeast = (role: ListAccessRole, min: ListAccessRole) => RANK[role] >= RANK[min];

/**
 * - `read`: see the list, its films and who added them.
 * - `edit_items`: add, remove, reorder and annotate films.
 * - `manage`: rename, describe, delete, invite, approve, change roles, remove people.
 */
export type ListAction = "read" | "edit_items" | "manage";

const MIN_ROLE: Record<ListAction, ListAccessRole> = {
  read: "VIEWER",
  edit_items: "EDITOR",
  manage: "OWNER",
};

export const minRoleFor = (action: ListAction) => MIN_ROLE[action];

export const canOnList = (role: ListAccessRole | null, action: ListAction) =>
  role != null && roleAtLeast(role, MIN_ROLE[action]);

/**
 * Roles a list can be shared with. Lists you create: viewer or editor.
 * Favoritas: only to look at. Quiero ver feeds Hoy, afinidad and the arrival
 * alerts, Top del año is validated against your own diary, and Por rewatch and
 * the series lists fill themselves: none of them are shared. Favoritas, Por
 * rewatch and the series lists are COLLECTION too, so the slug decides.
 */
export const shareableRoles = (list: { kind: ListKind; slug: string | null }): ListRole[] => {
  if (list.kind !== "COLLECTION") {
    return [];
  }
  if (list.slug === FAVORITAS_SLUG) {
    return ["VIEWER"];
  }
  if (isFixedListSlug(list.slug)) {
    return [];
  }
  return ["EDITOR", "VIEWER"];
};

export const isShareable = (list: { kind: ListKind; slug: string | null }) =>
  shareableRoles(list).length > 0;
