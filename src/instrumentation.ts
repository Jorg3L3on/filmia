/**
 * Server start. Installs the TMDB call counter (FIL-I37, see `@/lib/api-usage`). Then, local
 * development only: with FILMIA_LOCAL_PG=1 the app talks to a local Postgres instead of
 * Neon (FIL-I20 QA without touching production data). Does nothing otherwise.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/api-usage");
  }
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.FILMIA_LOCAL_PG === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    const { installLocalPg } = await import("@/db/local-pg");
    installLocalPg();
  }
}
