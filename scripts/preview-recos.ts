import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";

/**
 * FIL-I6-2 · preview of one user's recommended pool. READ-ONLY: it lists, scores and filters
 * exactly like the nightly cron but stops before creating Catalog rows or saving anything.
 *
 *   npm run preview:recos -- --env=<path to .env> --email=<a@b>
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

const main = async () => {
  const email = flag("email")?.toLowerCase();
  if (!email) {
    throw new Error("Falta --email=<cuenta>.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida (usa --env=<ruta al .env>).");
  }
  const { db, users } = await import("../src/db/index");
  const { loadTonightInput } = await import("../src/lib/tonight-store");
  const { buildRecoPool } = await import("../src/lib/tonight/reco-store");

  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) {
    throw new Error(`No existe la cuenta ${email}.`);
  }
  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL).host} (solo lectura)`);

  const started = Date.now();
  const input = await loadTonightInput(user.id);
  const result = await buildRecoPool(input, { dryRun: true });
  console.log(`\n${result.ok ? "OK" : "TMDB no respondió"} · ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(result.stats);
  console.log(`\nPlataformas: ${input.userPlatforms.join(", ") || "(ninguna)"}`);
  result.picks.forEach((pick, index) => {
    const reason = pick.reasons.find((item) => item.kind === "reco_seed" || item.kind === "reco_genre");
    console.log(
      `${String(index + 1).padStart(2)}. ${pick.candidate.name} (${pick.candidate.year ?? "s/f"}) · ${pick.candidate.kind === "SERIES" ? "serie" : "peli"} · ${pick.baseScore.toFixed(3)} · ${reason?.text ?? "—"}`,
    );
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
