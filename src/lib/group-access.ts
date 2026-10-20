import type { List } from "@/db";
import type { ListAccessRole } from "@/lib/list-access-core";
import type { ListPerson } from "@/lib/list-invites";
import { isFixedListSlug } from "@/lib/lists";
import { GROUP_MAX_WATCHING } from "@/lib/tonight/group";

/** FIL-I19-3 · who gets «Qué vemos juntos» and who is watching. No queries. */

/** On unless `GROUP_RECO_ENABLED` says otherwise: the kill switch without a revert. */
export const groupRecoEnabled = () =>
  !["0", "false", "off", "no"].includes((process.env.GROUP_RECO_ENABLED ?? "").trim().toLowerCase());

/** The people who decide: the owner and the editors (readers never count). */
export const deciders = (people: readonly ListPerson[]) => people.filter((person) => person.role !== "VIEWER");

/**
 * The list qualifies with at least one editor besides the owner, and the viewer
 * must be one of them. Fixed lists (Favoritas, Por rewatch…) never do.
 */
export const canWatchTogether = (
  list: Pick<List, "kind" | "slug">,
  role: ListAccessRole,
  people: readonly ListPerson[],
) =>
  groupRecoEnabled() &&
  list.kind === "COLLECTION" &&
  !isFixedListSlug(list.slug) &&
  role !== "VIEWER" &&
  people.some((person) => person.role === "EDITOR");

/** `?ven=a,b`: who is watching, kept to deciders; everyone by default. */
export const parseWatching = (value: string | string[] | undefined, people: readonly ListPerson[]) => {
  const ids = deciders(people).map((person) => person.id);
  const raw = (Array.isArray(value) ? value.join(",") : (value ?? "")).split(",").filter(Boolean);
  const chosen = ids.filter((id) => raw.includes(id));
  return (chosen.length > 0 ? chosen : ids).slice(0, GROUP_MAX_WATCHING);
};
