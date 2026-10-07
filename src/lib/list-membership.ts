export const WATCHLIST_MEMBERSHIP_SLUG = "watchlist";

export type TitleListMembership =
  | { state: "idle" }
  | { state: "watchlist" }
  | { state: "in-list"; list: { id: string; name: string; slug: string | null } };

const rankSlug = (slug: string | null) => {
  if (slug === WATCHLIST_MEMBERSHIP_SLUG) {
    return 0;
  }
  if (slug === "favoritas") {
    return 1;
  }
  if (slug === "por-rewatch") {
    return 2;
  }
  return 3;
};

const sortMemberLists = <T extends { slug: string | null; name: string }>(
  lists: T[],
) =>
  [...lists].sort((left, right) => {
    const delta = rankSlug(left.slug) - rankSlug(right.slug);
    if (delta !== 0) {
      return delta;
    }
    return left.name.localeCompare(right.name, "es");
  });

export const titleListMembership = (
  lists: Array<{ id: string; name: string; slug: string | null }>,
): TitleListMembership => {
  const ordered = sortMemberLists(lists);
  const collection = ordered.find((list) => list.slug !== WATCHLIST_MEMBERSHIP_SLUG);

  if (collection) {
    return { state: "in-list", list: collection };
  }

  if (ordered.some((list) => list.slug === WATCHLIST_MEMBERSHIP_SLUG)) {
    return { state: "watchlist" };
  }

  return { state: "idle" };
};

export const membershipCopy = (membership: TitleListMembership) => {
  if (membership.state === "in-list") {
    return {
      label: "En lista",
      detail: membership.list.name,
      hint: `Ya está en tu lista ${membership.list.name}.`,
    };
  }

  if (membership.state === "watchlist") {
    return {
      label: "En Quiero ver",
      detail: null,
      hint: "Ya está en Quiero ver.",
    };
  }

  return {
    label: "Quiero ver",
    detail: null,
    hint: "Guárdala para ver más tarde.",
  };
};

export type MemberList = { id: string; name: string; slug: string | null };

export type TitleListMemberships = {
  /** Quiero ver lives on its own toggle; it never counts as a «lista guardada». */
  inWatchlist: boolean;
  /** Every other list the title belongs to, ranked Favoritas › Por rewatch › A–Z. */
  lists: MemberList[];
};

/**
 * Full membership for the ficha. Unlike `titleListMembership` (which picks one
 * list for a compact label), nothing is dropped: every collection is returned.
 */
export const titleListMemberships = (
  lists: readonly MemberList[],
): TitleListMemberships => {
  const seen = new Set<string>();
  const unique = lists.filter((list) => {
    if (seen.has(list.id)) {
      return false;
    }
    seen.add(list.id);
    return true;
  });
  const ordered = sortMemberLists(unique);

  return {
    inWatchlist: ordered.some((list) => list.slug === WATCHLIST_MEMBERSHIP_SLUG),
    lists: ordered.filter((list) => list.slug !== WATCHLIST_MEMBERSHIP_SLUG),
  };
};

const joinListNames = (names: readonly string[]) =>
  names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;

/** Up to this many lists are named inline («Guardada en A y B»); more collapse to «En N listas». */
export const MEMBERSHIP_INLINE_LIMIT = 2;

/**
 * Status copy (not an action): «Guardada en Favoritas», «Guardada en Favoritas
 * y Noir», or «En 3 listas» with every name in `detail`. Null with no lists.
 */
export const membershipStatusCopy = (lists: readonly MemberList[]) => {
  if (lists.length === 0) {
    return null;
  }

  const names = lists.map((list) => list.name);
  if (names.length <= MEMBERSHIP_INLINE_LIMIT) {
    return {
      label: `Guardada en ${joinListNames(names)}`,
      detail: null,
      names,
      count: names.length,
    };
  }

  return {
    label: `En ${names.length} listas`,
    detail: names.join(" · "),
    names,
    count: names.length,
  };
};
