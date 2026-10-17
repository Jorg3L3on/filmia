import { getAssignableLists, getUserListMembershipIndex, getUserTmdbIndex } from "@/lib/queries";
import { requireUserId } from "@/lib/session";
import { getPinnedTonightTitleId } from "@/lib/tonight-store";

/** What CineActionsProvider needs: where each film lives in your Filmia, your lists, tonight's pin. */
export const loadCineActions = async () => {
  const userId = await requireUserId();
  const [existing, lists, memberships, pinnedTitleId] = await Promise.all([
    getUserTmdbIndex(),
    getAssignableLists(),
    getUserListMembershipIndex(),
    getPinnedTonightTitleId(userId),
  ]);
  return {
    userId,
    existing,
    lists: lists.map(({ id, name, slug }) => ({ id, name, slug })),
    memberships,
    pinnedTitleId,
  };
};
