export const NAV_PREFETCH_HREFS = [
  "/",
  "/watchlist",
  "/buscar",
  "/listas",
  "/perfil",
  "/tags",
] as const;

export const NAV_PREFETCH_IDLE_MS = 180;
export const NAV_PREFETCH_IDLE_TIMEOUT_MS = 800;

const pathOnly = (pathname: string) => pathname.split("?")[0] ?? pathname;

export const collectWarmNavHrefs = (
  currentPath: string,
  recentFichas: readonly string[] = [],
) => {
  const path = pathOnly(currentPath);
  const seen = new Set<string>();
  const hrefs: string[] = [];

  for (const href of [...NAV_PREFETCH_HREFS, ...recentFichas]) {
    if (!href || href === path || seen.has(href)) {
      continue;
    }
    seen.add(href);
    hrefs.push(href);
  }

  return hrefs;
};

export const scheduleIdleWork = (work: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(work, {
      timeout: NAV_PREFETCH_IDLE_TIMEOUT_MS,
    });
    return () => window.cancelIdleCallback(idleId);
  }

  const timer = window.setTimeout(work, NAV_PREFETCH_IDLE_MS);
  return () => window.clearTimeout(timer);
};
