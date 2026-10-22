import { scheduleAfterResponse } from "@/lib/after-response";
import { isTmdbConfigured } from "@/lib/tmdb";
import {
  hydrateMissingTitleOverviews,
  titleNeedsHydration,
  type HydrateOptions,
} from "@/lib/title-overview-hydrate";

type OverviewTitle = Parameters<typeof hydrateMissingTitleOverviews>[0][number];

export const scheduleMissingTitleOverviews = <T extends OverviewTitle>(
  titleRows: T[],
  options: HydrateOptions = {},
) => {
  if (!isTmdbConfigured() || !titleRows.some((title) => titleNeedsHydration(title, options))) {
    return;
  }

  scheduleAfterResponse(async () => {
    await hydrateMissingTitleOverviews(titleRows, options);
  });
};
