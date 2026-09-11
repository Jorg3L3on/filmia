/**
 * Filmia rendering + cache policy (Fase 4 / JOR-215).
 *
 * Auth-gated pages stay request-time via `export const dynamic = "force-dynamic"`
 * (Next requires a string literal, not a shared constant).
 *
 * Why `force-dynamic` stays: Neon serverless talks HTTP `fetch`. Enabling
 * `fetchCache = "default-cache"` (or Cache Components) could cache those
 * queries across users. Cookie session + per-user SQL must not be statically
 * shared. Login / registro stay on the default (no `dynamic`) so the public
 * auth screens can be static.
 *
 * Cross-request metadata still caches: TMDB / OMDb wrap `unstable_cache`
 * (86400s) with public tags (`tmdb-metadata` / `omdb-metadata`) so
 * `force-dynamic` does not defeat poster extras and on-demand revalidateTag
 * stays available. Soft-nav reuse is `experimental.staleTimes.dynamic` in
 * next.config.ts (30s), not a product feature flag. Do not flip
 * `cacheComponents` on — it drops `dynamic` and would prerender cookie
 * reads in the root layout.
 *
 * Route surface → decision (audit):
 * - `/` (diario)              → force-dynamic — user diary / picks / platforms
 * - `/watchlist`              → force-dynamic — user Quiero ver queue
 * - `/buscar`                 → force-dynamic — user TMDB index + session;
 *                               public TMDB search still hits tagged cache
 * - `/listas`, `/listas/[id]` → force-dynamic — user lists / membership
 * - `/listas/nueva`           → force-dynamic — auth-gated write surface
 * - `/listas/[id]/editar`     → force-dynamic — user list row
 * - `/tags`, `/tags/[slug]`   → force-dynamic — user tags / ranked titles
 * - `/titulos/[id]`           → force-dynamic — user ficha + lists/tags;
 *                               TMDB/OMDb extras via tagged unstable_cache
 * - `/titulos/[id]/editar`    → force-dynamic — user title edit
 * - `/titulos/nuevo`          → no force-dynamic — redirect-only to `/buscar`
 * - `/perfil`                 → force-dynamic — user profile / platforms
 * - `/login`, `/registro`     → no force-dynamic — public auth screens
 * - `AppShell` / chrome       → server fragments; no route `dynamic` export
 * - Shared catalogs (labels, platform ids) → module constants, not RSC cache
 *
 * Vercel: env vars + `db:migrate` run outside `next build`. No deploy from
 * this phase. Prefer App Router patterns already in-repo (segment `dynamic`,
 * `unstable_cache` + tags, React `cache` for request dedupe, `revalidatePath`).
 * Do not introduce `unstable_noStore` on these surfaces — `force-dynamic`
 * already opts the segment out of static fetch caching.
 */
export const AUTH_PAGE_DYNAMIC = "force-dynamic" as const;

export const METADATA_REVALIDATE_SECONDS = 86400;

/** Public TMDB JSON cache tag (safe across users). */
export const TMDB_CACHE_TAG = "tmdb-metadata" as const;

/** Public OMDb IMDb-rating cache tag (safe across users). */
export const OMDB_CACHE_TAG = "omdb-metadata" as const;

/** Auth-gated App Router pages that must stay request-time (Neon + session). */
export const AUTH_DYNAMIC_PAGES = [
  "src/app/(diario)/page.tsx",
  "src/app/watchlist/page.tsx",
  "src/app/buscar/page.tsx",
  "src/app/listas/page.tsx",
  "src/app/listas/[id]/page.tsx",
  "src/app/listas/[id]/editar/page.tsx",
  "src/app/listas/nueva/page.tsx",
  "src/app/tags/page.tsx",
  "src/app/tags/[slug]/page.tsx",
  "src/app/titulos/[id]/page.tsx",
  "src/app/titulos/[id]/editar/page.tsx",
  "src/app/perfil/page.tsx",
] as const;

/** Public screens that must NOT force-dynamic (static-eligible shells). */
export const PUBLIC_STATIC_ELIGIBLE_PAGES = [
  "src/app/login/page.tsx",
  "src/app/registro/page.tsx",
] as const;
