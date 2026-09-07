import { scheduleAfterResponse } from "@/lib/after-response";
import { isTmdbConfigured } from "@/lib/tmdb";
import {
  hydrateMissingTitleOverviews,
  titleNeedsOverviewHydration,
} from "@/lib/title-overview-hydrate";

type OverviewTitle = Parameters<typeof hydrateMissingTitleOverviews>[0][number];

export const scheduleMissingTitleOverviews = <T extends OverviewTitle>(
  titleRows: T[],
) => {
  if (!isTmdbConfigured() || !titleRows.some(titleNeedsOverviewHydration)) {
    return;
  }

  scheduleAfterResponse(async () => {
    await hydrateMissingTitleOverviews(titleRows);
  });
};
