import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  AUTH_DYNAMIC_PAGES,
  AUTH_PAGE_DYNAMIC,
  METADATA_REVALIDATE_SECONDS,
  OMDB_CACHE_TAG,
  PUBLIC_STATIC_ELIGIBLE_PAGES,
  TMDB_CACHE_TAG,
} from "../src/lib/rendering";
import {
  collectWarmNavHrefs,
  resolveNavPrefetchPolicy,
} from "../src/lib/nav-prefetch";
import { HISTORIAL_DEFAULT_VIEW } from "../src/lib/diary-view";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const walkTsx = (dir: string, acc: string[] = []) => {
  for (const entry of readdirSync(path.join(root, dir))) {
    const rel = path.join(dir, entry);
    const full = path.join(root, rel);
    if (statSync(full).isDirectory()) {
      walkTsx(rel, acc);
      continue;
    }
    if (rel.endsWith(".tsx") || rel.endsWith(".ts")) {
      acc.push(rel);
    }
  }
  return acc;
};

const countLines = (file: string) => read(file).split("\n").length;

const run = () => {
  assert(AUTH_PAGE_DYNAMIC === "force-dynamic", "Auth pages stay request-time");
  assert(
    HISTORIAL_DEFAULT_VIEW === "calendar",
    "Historial default view stays calendar (Artist F1)",
  );

  const coverflow = countLines("src/components/CoverflowDeck.tsx");
  const filters = countLines("src/components/CatalogFilters.tsx");
  const search = countLines("src/components/TmdbSearchAdd.tsx");
  assert(coverflow < 280, `CoverflowDeck orchestrator is still large (${coverflow})`);
  assert(filters < 220, `CatalogFilters orchestrator is still large (${filters})`);
  assert(search < 430, `TmdbSearchAdd orchestrator is still large (${search})`);
  assert(
    read("src/components/coverflow/useCoverflowEngine.ts").includes("useCoverflowEngine"),
    "Coverflow engine lives in its own module",
  );
  assert(
    read("src/components/coverflow/DeckCard.tsx").includes("DeckCard"),
    "Deck cards are a focused module",
  );
  assert(
    read("src/components/catalog-filters/CatalogFilterSheet.tsx").includes("CatalogFilterSheet"),
    "Catalog filter sheet is split from the bar",
  );
  assert(
    read("src/components/TmdbSearchResults.tsx").includes("TmdbSearchResults"),
    "Search results are a focused module",
  );
  assert(
    read("src/components/coverflow/CoverflowIndicators.tsx").includes("CoverflowIndicators") &&
      read("src/components/coverflow/useCoverflowLocalTitles.ts").includes("useCoverflowLocalTitles"),
    "Coverflow indicators + local-title state are colocated modules",
  );
  assert(
    read("src/components/catalog-filters/CatalogKindChips.tsx").includes("CatalogKindChips") &&
      read("src/components/catalog-filters/useCatalogFiltersState.ts").includes("useCatalogFiltersState"),
    "Catalog kind chips + filter state hook are colocated modules",
  );
  assert(
    read("src/components/tmdb-search/useTmdbSearchAdd.ts").includes("useTmdbSearchAdd") &&
      read("src/components/tmdb-search/TmdbSearchForm.tsx").includes("TmdbSearchForm") &&
      read("src/components/tmdb-search/TmdbKindFilterChips.tsx").includes("TmdbKindFilterChips"),
    "Tmdb search form/chips/state are colocated modules",
  );

  const appShell = read("src/components/AppShell.tsx");
  const siteHeader = read("src/components/SiteHeader.tsx");
  const siteHeaderNav = read("src/components/SiteHeaderNav.tsx");
  const appChrome = read("src/components/AppChrome.tsx");
  const bottomNav = read("src/components/BottomNav.tsx");
  const authGate = read("src/components/AuthChromeGate.tsx");
  const activeNav = read("src/components/ActiveNavLink.tsx");
  const bottomShell = read("src/components/BottomNavShell.tsx");
  assert(!appShell.startsWith('"use client"'), "AppShell stays a server shell");
  assert(!siteHeader.startsWith('"use client"'), "SiteHeader chrome stays server");
  assert(!appChrome.startsWith('"use client"'), "AppChrome frame stays server");
  assert(!siteHeaderNav.startsWith('"use client"'), "SiteHeaderNav stays server");
  assert(!bottomNav.startsWith('"use client"'), "BottomNav stays server");
  assert(appShell.includes("AppChrome"), "AppShell slots chrome through AppChrome");
  assert(siteHeader.includes("SiteHeaderNav"), "SiteHeader composes SiteHeaderNav");
  assert(appChrome.includes("AuthChromeGate"), "AppChrome delegates auth hide to a client leaf");
  assert(appChrome.includes("safe-area-inset-bottom"), "AppChrome keeps main safe-area class");
  assert(authGate.startsWith('"use client"') && authGate.includes("isAuthChromePath"), "AuthChromeGate is the auth-path client leaf");
  assert(activeNav.startsWith('"use client"') && activeNav.includes("usePathname"), "ActiveNavLink is the active-state client leaf");
  assert(bottomShell.startsWith('"use client"') && bottomShell.includes("usePathname"), "BottomNavShell is the mobile-nav client leaf");
  assert(siteHeaderNav.includes("ActiveNavLink") && siteHeaderNav.includes("LogoutButton"), "Header interactive bits stay small client leaves");
  assert(bottomNav.includes("ActiveNavLink") && bottomNav.includes("BottomNavShell") && bottomNav.includes("NavIcon"), "Bottom nav composes shell + active links + server icons");
  assert(
    !read("src/app/layout.tsx").startsWith('"use client"'),
    "Root layout remains a server component",
  );

  assert(
    read("src/app/titulos/nuevo/page.tsx").includes('redirect("/buscar")') &&
      !read("src/app/titulos/nuevo/page.tsx").includes('export const dynamic = "force-dynamic"'),
    "titulos/nuevo redirects to Buscar without force-dynamic",
  );

  for (const file of AUTH_DYNAMIC_PAGES) {
    const source = read(file);
    assert(
      source.includes('export const dynamic = "force-dynamic"'),
      `${file} should keep request-time rendering`,
    );
    assert(
      !source.includes("cacheComponents"),
      `${file} must not flip Cache Components on`,
    );
    assert(
      !source.includes("unstable_noStore") && !source.includes("noStore("),
      `${file} must not add unstable_noStore (force-dynamic is enough)`,
    );
  }
  for (const file of PUBLIC_STATIC_ELIGIBLE_PAGES) {
    assert(
      !read(file).includes('export const dynamic = "force-dynamic"'),
      `${file} stays eligible for static rendering`,
    );
  }
  const tmdb = read("src/lib/tmdb.ts");
  const omdb = read("src/lib/omdb.ts");
  const rendering = read("src/lib/rendering.ts");
  assert(
    tmdb.includes("unstable_cache") && omdb.includes("unstable_cache"),
    "TMDB/OMDb metadata uses unstable_cache across force-dynamic pages",
  );
  assert(
    tmdb.includes("tags: [TMDB_CACHE_TAG]") &&
      omdb.includes("tags: [OMDB_CACHE_TAG]") &&
      TMDB_CACHE_TAG === "tmdb-metadata" &&
      OMDB_CACHE_TAG === "omdb-metadata" &&
      METADATA_REVALIDATE_SECONDS === 86400,
    "Public TMDB/OMDb caches carry safe tags + 86400s revalidate",
  );
  assert(
    rendering.includes("Route surface → decision") &&
      AUTH_DYNAMIC_PAGES.length === 12 &&
      PUBLIC_STATIC_ELIGIBLE_PAGES.length === 2,
    "Rendering audit table documents route → dynamic/cached decisions",
  );
  assert(
    read("next.config.ts").includes("staleTimes") &&
      !read("next.config.ts").includes("cacheComponents: true"),
    "Warm nav staleTimes stay on; Cache Components stay off",
  );

  assert(
    read("src/components/ListTitlesGrid.tsx").includes("WindowVirtualGrid"),
    "Long list grids window-virtualize",
  );
  assert(
    read("src/components/WatchlistList.tsx").includes("WindowVirtualList"),
    "Long Quiero ver queues stay window-virtualized",
  );
  assert(
    collectWarmNavHrefs("/watchlist", ["/titulos/a"]).includes("/titulos/a") &&
      !collectWarmNavHrefs("/watchlist").includes("/watchlist"),
    "Nav prefetch skips the current route and keeps recent fichas",
  );
  assert(
    resolveNavPrefetchPolicy({ saveData: true }).enabled === false &&
      resolveNavPrefetchPolicy({ effectiveType: "2g" }).maxNavHrefs === 1 &&
      resolveNavPrefetchPolicy({ effectiveType: "3g" }).maxRecentFichas === 1 &&
      resolveNavPrefetchPolicy({ effectiveType: "4g" }).staggerMs === 0,
    "Nav prefetch budgets slow / Save-Data networks",
  );
  assert(
    collectWarmNavHrefs(
      "/watchlist",
      ["/titulos/a"],
      resolveNavPrefetchPolicy({ effectiveType: "2g" }),
    ).length === 1 &&
      !collectWarmNavHrefs(
        "/watchlist",
        ["/titulos/a"],
        resolveNavPrefetchPolicy({ effectiveType: "2g" }),
      ).includes("/titulos/a"),
    "2g warm nav keeps one neighbor and drops recent fichas",
  );
  assert(
    read("src/components/NavPrefetch.tsx").includes("scheduleIdleWork") &&
      read("src/components/NavPrefetch.tsx").includes("warmedHrefs") &&
      read("src/components/NavPrefetch.tsx").includes("resolveNavPrefetchPolicy") &&
      read("src/components/NavPrefetch.tsx").includes("scheduleStaggeredWork"),
    "Nav prefetch idles, budgets by connection, and does not re-warm the same href",
  );
  assert(
    read("src/components/ListTitlesGrid.tsx").includes("renderCell(item, index, false)") &&
      read("src/components/WatchlistList.tsx").includes("WATCHLIST_VIRTUALIZE_AFTER"),
    "Virtualized listas/watchlist keep F3 wells and skip scroll thrash stagger",
  );

  const sources = [...walkTsx("src/app"), ...walkTsx("src/components"), ...walkTsx("src/lib")];
  for (const file of sources) {
    const source = read(file);
    assert(!source.includes("serviceWorker"), `${file} must not add a PWA worker`);
    assert(!source.includes("manifest.webmanifest"), `${file} must not add a PWA manifest`);
  }
  assert(
    read("src/app/globals.css").includes("#7c9cff"),
    "Accent stays #7c9cff",
  );
  assert(
    read("src/lib/use-optimistic-action.ts").includes("useStickyOptimistic"),
    "Optimistic mutations stay in place",
  );

  const queries = read("src/lib/queries.ts");
  const titleActions = read("src/app/actions/titles.ts");
  assert(
    queries.includes("countByIds") &&
      !queries.includes("rows.map(async") &&
      !queries.includes("withCounts = await Promise.all"),
    "List/tag counts stay batched via countByIds (no per-row count N+1)",
  );
  assert(
    queries.includes("getRelatedTitles") &&
      queries.includes("inArray(titleTags.tagId, tagIds)") &&
      queries.includes("desc(titles.watchedAt)") &&
      !queries.includes("selectDistinct({ titleId: titleTags.titleId })"),
    "Ficha related titles are one select with inArray + watchedAt order",
  );
  assert(
    queries.includes("getListMetaById") &&
      queries.includes("getTitleOptionsOutsideList") &&
      read("src/app/listas/[id]/editar/page.tsx").includes("getListMetaById") &&
      read("src/app/listas/[id]/page.tsx").includes("getTitleOptionsOutsideList"),
    "Listas editar skips item graph; detail excludes members in SQL",
  );
  assert(
    titleActions.includes("collectionSet") &&
      titleActions.includes("ownedSelected") &&
      !titleActions.includes("for (const [index, listId] of listIds.entries())"),
    "Ficha syncLists batches ownership via collectionSet (no per-list findFirst)",
  );
  assert(
    titleActions.includes("inArray(tags.slug, slugs)") &&
      !titleActions.includes("newTags.map(async"),
    "Ficha syncTags loads existing tags once with inArray(slugs)",
  );

  console.log(
    `✓ Fase 4 perf/datos: CoverflowDeck ${coverflow} · CatalogFilters ${filters} · TmdbSearchAdd ${search} · chrome leaves · force-dynamic audit (${AUTH_DYNAMIC_PAGES.length} auth / ${PUBLIC_STATIC_ELIGIBLE_PAGES.length} public) · tagged TMDB/OMDb · N+1 ficha/listas`,
  );
};

run();
