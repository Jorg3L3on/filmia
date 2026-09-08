/**
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
 * (86400s) so `force-dynamic` does not defeat poster extras. Soft-nav reuse
 * is `experimental.staleTimes.dynamic` in next.config.ts (30s), not a
 * product feature flag. Do not flip `cacheComponents` on — it drops
 * `dynamic` and would prerender cookie reads in the root layout.
 *
 * Vercel: env vars + `db:migrate` run outside `next build`. No deploy from
 * this phase.
 */
export const AUTH_PAGE_DYNAMIC = "force-dynamic" as const;

export const METADATA_REVALIDATE_SECONDS = 86400;
