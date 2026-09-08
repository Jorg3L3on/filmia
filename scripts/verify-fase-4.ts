import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { AUTH_PAGE_DYNAMIC } from "../src/lib/rendering";
import { collectWarmNavHrefs } from "../src/lib/nav-prefetch";
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
    HISTORIAL_DEFAULT_VIEW === "deck",
    "Historial default view stays mazo",
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

  const appShell = read("src/components/AppShell.tsx");
  const siteHeader = read("src/components/SiteHeader.tsx");
  const appChrome = read("src/components/AppChrome.tsx");
  assert(!appShell.startsWith('"use client"'), "AppShell stays a server shell");
  assert(!siteHeader.startsWith('"use client"'), "SiteHeader chrome stays server");
  assert(appShell.includes("AppChrome"), "AppShell slots chrome into a small client island");
  assert(siteHeader.includes("SiteHeaderNav"), "Active nav is the client island");
  assert(appChrome.includes("isAuthChromePath"), "Auth paths still hide chrome");
  assert(
    !read("src/app/layout.tsx").startsWith('"use client"'),
    "Root layout remains a server component",
  );

  const authPages = [
    "src/app/(diario)/page.tsx",
    "src/app/watchlist/page.tsx",
    "src/app/buscar/page.tsx",
    "src/app/listas/page.tsx",
    "src/app/listas/[id]/page.tsx",
    "src/app/listas/[id]/editar/page.tsx",
    "src/app/listas/nueva/page.tsx",
    "src/app/tags/page.tsx",
    "src/app/tags/[slug]/page.tsx",
    "src/app/titulos/nuevo/page.tsx",
    "src/app/titulos/[id]/page.tsx",
    "src/app/titulos/[id]/editar/page.tsx",
    "src/app/perfil/page.tsx",
  ];
  for (const file of authPages) {
    const source = read(file);
    assert(
      source.includes('export const dynamic = "force-dynamic"'),
      `${file} should keep request-time rendering`,
    );
    assert(
      !source.includes("cacheComponents"),
      `${file} must not flip Cache Components on`,
    );
  }
  assert(
    !read("src/app/login/page.tsx").includes('export const dynamic = "force-dynamic"'),
    "Login stays eligible for static rendering",
  );
  assert(
    !read("src/app/registro/page.tsx").includes('export const dynamic = "force-dynamic"'),
    "Registro stays eligible for static rendering",
  );
  assert(
    read("src/lib/tmdb.ts").includes("unstable_cache") &&
      read("src/lib/omdb.ts").includes("unstable_cache"),
    "TMDB/OMDb metadata uses unstable_cache across force-dynamic pages",
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
    read("src/components/NavPrefetch.tsx").includes("scheduleIdleWork") &&
      read("src/components/NavPrefetch.tsx").includes("warmedHrefs"),
    "Nav prefetch idles and does not re-warm the same href",
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

  console.log(
    `✓ Fase 4 perf/datos: CoverflowDeck ${coverflow} · CatalogFilters ${filters} · TmdbSearchAdd ${search}`,
  );
};

run();
