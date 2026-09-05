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
