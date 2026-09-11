import { FICHA_CACHE_LIMIT } from "@/lib/ficha-session";

export const NAV_PREFETCH_HREFS = [
  "/",
  "/watchlist",
  "/buscar",
  "/listas",
  "/perfil",
  "/tags",
] as const;

/** Soft-nav priority for neighbor warming (mobile-first, then tags). */
export const NAV_PREFETCH_PRIORITY = [
  "/",
  "/watchlist",
  "/buscar",
  "/listas",
  "/tags",
  "/perfil",
] as const;

export const NAV_PREFETCH_IDLE_MS = 180;
export const NAV_PREFETCH_IDLE_TIMEOUT_MS = 800;

export type NavPrefetchConnection = {
  downlink?: number;
  effectiveType?: string;
  saveData?: boolean;
};

export type NavPrefetchPolicy = {
  /** When false, skip warm nav entirely (Save-Data / offline). */
  enabled: boolean;
  maxNavHrefs: number;
  maxRecentFichas: number;
  idleMs: number;
  idleTimeoutMs: number;
  /** Delay between each router.prefetch; 0 = burst (fast links). */
  staggerMs: number;
};

export const NAV_PREFETCH_POLICY_FAST: NavPrefetchPolicy = {
  enabled: true,
  maxNavHrefs: NAV_PREFETCH_HREFS.length,
  maxRecentFichas: FICHA_CACHE_LIMIT,
  idleMs: NAV_PREFETCH_IDLE_MS,
  idleTimeoutMs: NAV_PREFETCH_IDLE_TIMEOUT_MS,
  staggerMs: 0,
};

export const NAV_PREFETCH_POLICY_OFF: NavPrefetchPolicy = {
  enabled: false,
  maxNavHrefs: 0,
  maxRecentFichas: 0,
  idleMs: 1200,
  idleTimeoutMs: 4000,
  staggerMs: 0,
};

const pathOnly = (pathname: string) => pathname.split("?")[0] ?? pathname;

const navIndex = (pathname: string) => {
  const path = pathOnly(pathname);
  const exact = NAV_PREFETCH_PRIORITY.indexOf(
    path as (typeof NAV_PREFETCH_PRIORITY)[number],
  );
  if (exact >= 0) {
    return exact;
  }
  if (path.startsWith("/titulos/")) {
    return 0; // ficha lives under Diario in the chrome
  }
  if (path.startsWith("/listas/")) {
    return NAV_PREFETCH_PRIORITY.indexOf("/listas");
  }
  if (path.startsWith("/tags/")) {
    return NAV_PREFETCH_PRIORITY.indexOf("/tags");
  }
  return -1;
};

/** Prefer soft-nav neighbors of the current surface (distance ASC). */
export const prioritizeNavHrefs = (
  currentPath: string,
  hrefs: readonly string[],
) => {
  const current = navIndex(currentPath);
  return [...hrefs].sort((a, b) => {
    const da =
      current < 0
        ? NAV_PREFETCH_PRIORITY.indexOf(a as (typeof NAV_PREFETCH_PRIORITY)[number])
        : Math.abs(navIndex(a) - current);
    const db =
      current < 0
        ? NAV_PREFETCH_PRIORITY.indexOf(b as (typeof NAV_PREFETCH_PRIORITY)[number])
        : Math.abs(navIndex(b) - current);
    if (da !== db) {
      return da - db;
    }
    return (
      NAV_PREFETCH_PRIORITY.indexOf(a as (typeof NAV_PREFETCH_PRIORITY)[number]) -
      NAV_PREFETCH_PRIORITY.indexOf(b as (typeof NAV_PREFETCH_PRIORITY)[number])
    );
  });
};

/**
 * Connection-aware budget. Fast links stay snappy (full warm); slow / Save-Data
 * cuts routes, drops recent fichas, and idles longer so prefetch does not thrash.
 */
export const resolveNavPrefetchPolicy = (
  connection?: NavPrefetchConnection | null,
): NavPrefetchPolicy => {
  if (!connection) {
    return NAV_PREFETCH_POLICY_FAST;
  }

  if (connection.saveData) {
    return NAV_PREFETCH_POLICY_OFF;
  }

  const effective = connection.effectiveType ?? "4g";
  if (effective === "slow-2g" || effective === "2g") {
    return {
      enabled: true,
      maxNavHrefs: 1,
      maxRecentFichas: 0,
      idleMs: 900,
      idleTimeoutMs: 2800,
      staggerMs: 450,
    };
  }

  if (effective === "3g") {
    return {
      enabled: true,
      maxNavHrefs: 3,
      maxRecentFichas: 1,
      idleMs: 450,
      idleTimeoutMs: 1600,
      staggerMs: 220,
    };
  }

  // Weak 4g: still warm, but lightly stagger if downlink is tiny.
  if (
    typeof connection.downlink === "number" &&
    connection.downlink > 0 &&
    connection.downlink < 1.5
  ) {
    return {
      enabled: true,
      maxNavHrefs: 4,
      maxRecentFichas: 2,
      idleMs: 320,
      idleTimeoutMs: 1200,
      staggerMs: 120,
    };
  }

  return NAV_PREFETCH_POLICY_FAST;
};

export const readBrowserConnection = (): NavPrefetchConnection | null => {
  if (typeof navigator === "undefined") {
    return null;
  }

  const nav = navigator as Navigator & {
    connection?: NavPrefetchConnection;
    mozConnection?: NavPrefetchConnection;
    webkitConnection?: NavPrefetchConnection;
  };
  const connection =
    nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
  if (!connection) {
    return null;
  }

  return {
    downlink: connection.downlink,
    effectiveType: connection.effectiveType,
    saveData: connection.saveData,
  };
};

export const collectWarmNavHrefs = (
  currentPath: string,
  recentFichas: readonly string[] = [],
  policy: Pick<NavPrefetchPolicy, "maxNavHrefs" | "maxRecentFichas"> = {
    maxNavHrefs: NAV_PREFETCH_HREFS.length,
    maxRecentFichas: FICHA_CACHE_LIMIT,
  },
) => {
  const path = pathOnly(currentPath);
  const seen = new Set<string>();
  const hrefs: string[] = [];

  const navCandidates = prioritizeNavHrefs(
    path,
    NAV_PREFETCH_HREFS.filter((href) => href !== path),
  ).slice(0, Math.max(0, policy.maxNavHrefs));

  for (const href of navCandidates) {
    if (!href || seen.has(href)) {
      continue;
    }
    seen.add(href);
    hrefs.push(href);
  }

  let fichasLeft = Math.max(0, policy.maxRecentFichas);
  for (const href of recentFichas) {
    if (fichasLeft <= 0) {
      break;
    }
    if (!href || href === path || seen.has(href)) {
      continue;
    }
    seen.add(href);
    hrefs.push(href);
    fichasLeft -= 1;
  }

  return hrefs;
};

export const scheduleIdleWork = (
  work: () => void,
  options?: { idleMs?: number; idleTimeoutMs?: number },
) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const idleMs = options?.idleMs ?? NAV_PREFETCH_IDLE_MS;
  const idleTimeoutMs = options?.idleTimeoutMs ?? NAV_PREFETCH_IDLE_TIMEOUT_MS;

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(work, {
      timeout: idleTimeoutMs,
    });
    return () => window.cancelIdleCallback(idleId);
  }

  const timer = window.setTimeout(work, idleMs);
  return () => window.clearTimeout(timer);
};

/** Fire work items with optional stagger; returns a cancel fn. */
export const scheduleStaggeredWork = (
  items: readonly (() => void)[],
  staggerMs: number,
) => {
  if (items.length === 0) {
    return () => {};
  }

  if (staggerMs <= 0 || typeof window === "undefined") {
    for (const item of items) {
      item();
    }
    return () => {};
  }

  const timers: number[] = [];
  items.forEach((item, index) => {
    const id = window.setTimeout(item, index * staggerMs);
    timers.push(id);
  });
  return () => {
    for (const id of timers) {
      window.clearTimeout(id);
    }
  };
};
