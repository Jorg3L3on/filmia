"use client";

import {
  useAtmosphereOn,
  usePauseAmbientWhenHidden,
  useSyncedShimmer,
} from "@/lib/motion-atmosphere";

/**
 * The app's single grain layer (FIL-I46-1): mounted once in the chrome, above the content and
 * under the dock and sheets, never under reduced motion or lite sala. Four steps of a
 * translated noise tile; it stops while the tab is hidden. Also puts every skeleton sweep on
 * one clock (a skeleton is the other app-wide ambient layer).
 */
export const FilmGrain = () => {
  const on = useAtmosphereOn();
  usePauseAmbientWhenHidden(on);
  useSyncedShimmer();
  return on ? <div aria-hidden data-film-grain className="film-grain" /> : null;
};
