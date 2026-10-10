import { config as loadEnv } from "dotenv";
import { eq, max } from "drizzle-orm";

/**
 * FIL-I6-3 · what Hoy would show one user right now, lens by lens (queue + recommended).
 * READ-ONLY: it refuses to run when the stored picks are stale, because reading Hoy would
 * then recompute and rewrite them (the app does that on a visit; a preview should not).
 *
 *   npm run preview:decks -- --env=<path to .env> --email=<a@b>
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
  const { db, tonightPicks, users } = await import("../src/db/index");
  const { getTonightDecks, TONIGHT_STALE_MS } = await import("../src/lib/tonight-store");
  const { interleaveBySource } = await import("../src/lib/tonight/compose");
  const { rankForNow } = await import("../src/lib/tonight/serve");

  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) {
    throw new Error(`No existe la cuenta ${email}.`);
  }
  const [newest] = await db
    .select({ at: max(tonightPicks.computedAt) })
    .from(tonightPicks)
    .where(eq(tonightPicks.userId, user.id));
  if (!newest?.at || Date.now() - newest.at.getTime() > TONIGHT_STALE_MS) {
    console.log("Los picks guardados están rancios: leer Hoy los recalcularía y reescribiría. No se ejecuta.");
    return;
  }

  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL).host} (solo lectura)`);
  const decks = await getTonightDecks(user.id);
  const now = new Date();
  console.log(`Plataformas: ${decks.userPlatforms.join(", ")} · cola: ${decks.queueSize}\n`);
  for (const lens of decks.lenses) {
    const ranked = interleaveBySource(
      rankForNow(lens.titles, {
        now,
        nightEnds: decks.nightEnds,
        keepWildcardLast: lens.kind === "para-ti",
        keepPinnedFirst: lens.kind === "para-ti",
      }),
    );
    const queue = ranked.filter((card) => card.source === "queue").length;
    console.log(`== ${lens.name} (${lens.kind}) · ${queue} de cola + ${ranked.length - queue} recomendadas`);
    for (const card of ranked) {
      const reason = card.headline[0]?.text ?? "—";
      console.log(
        `   ${card.source === "reco" ? "REC" : "Q  "} ${card.pinned ? "★" : " "}${card.wildcard ? "?" : " "} ${card.name} (${card.year ?? "s/f"}) · ${reason}`,
      );
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
