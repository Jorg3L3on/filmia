"use client";

import { useEffect } from "react";
import { markHistoryPop, rememberPosterFlight, titleIdFromHref } from "@/lib/poster-flight";

/**
 * Before a tap opens a ficha, remember the image of the poster that will fly (FIL-I46-2): the
 * `SharedPoster` marked with that title id. Capture phase, so it runs before Next navigates.
 * Also notes history traversals, the only navigations where the poster flies home by itself.
 */
export const PosterFlightCapture = () => {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      const titleId = titleIdFromHref(anchor?.getAttribute("href"));
      if (!titleId) return;
      const image = document.querySelector<HTMLImageElement>(`[data-shared-poster="${CSS.escape(titleId)}"] img`);
      const src = image?.currentSrc || image?.src;
      rememberPosterFlight(titleId, src ?? "");
    };
    const onPop = () => markHistoryPop();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);
  return null;
};
