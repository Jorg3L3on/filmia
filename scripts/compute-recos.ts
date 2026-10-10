import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";

/**
 * FIL-I6-2 · run the nightly recommendation job for ONE account (what the cron does for
 * everyone). WRITES: replaces the user's TonightReco pool and creates/enriches the Catalog
 * rows of the films it keeps. Always a single, named account.
 *
 *   npm run compute:recos -- --env=<path to .env> --email=<a@b>
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
  const { computeRecosForUser } = await import("../src/lib/tonight/reco-store");

  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) {
    throw new Error(`No existe la cuenta ${email}.`);
  }
  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL).host} (ESCRIBE para ${email})`);

  const started = Date.now();
  const result = await computeRecosForUser(user.id);
  console.log(`\n${result.ok ? "OK" : "TMDB no respondió: se conserva la reserva anterior"} · ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(result.stats);
  console.log(`Guardadas: ${result.picks.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
