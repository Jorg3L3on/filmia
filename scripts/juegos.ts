import { config as loadEnv } from "dotenv";

/**
 * FIL-I50 · Juegos from the console.
 *
 *   npm run juegos:avisos            # read-only: who would get a Juegos push now, and which one
 *   npm run metrics:juegos           # read-only: aggregates of Juegos, La tanda (FIL-I50-6) and partidas (FIL-I52-6)
 *   npm run metrics:juegos -- --liga # the liga review window: four weeks before its launch and four after (FIL-I55-4)
 *
 * Both take --env=<path to .env>. With FILMIA_LOCAL_PG=1 they talk to the local Postgres in DATABASE_URL.
 * Nothing here sends a push or writes a row: the daily cron does that.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const command = args.find((arg) => !arg.startsWith("--")) ?? "avisos";

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

const avisos = async () => {
  const { selectJuegosPushTargets } = await import("../src/lib/juegos/push-store");
  const targets = await selectJuegosPushTargets(new Date());
  if (targets.length === 0) {
    console.log("Nadie recibiría un aviso de Extras ahora.");
    return;
  }
  // Ids only: no emails or names in the console.
  for (const target of targets) {
    console.log(`${target.userId}  ${target.plan.kind === "launch" ? `lanzamiento · ${target.plan.juego.name}` : "tanda de la semana"}`);
  }
  console.log(`${targets.length} aviso(s). Corrida en seco: no se envió nada.`);
};

const metrics = async () => {
  const { loadJuegosMetrics } = await import("../src/lib/juegos/metrics");
  const report = await loadJuegosMetrics(new Date(), Number(flag("semanas") ?? 6));
  console.log("Semana       visitas  botón  bloque  empezadas  terminadas  regresan a 7 días");
  for (const row of report.weeks) {
    console.log(
      `${row.week}  ${String(row.visits).padStart(7)}  ${String(row.viaBoton).padStart(5)}  ${String(row.viaBloque).padStart(6)}  ${String(row.started).padStart(9)}  ${String(row.finished).padStart(10)}  ${row.returned7d == null ? "        —" : String(row.returned7d).padStart(9)}`,
    );
  }
  // FIL-I52-6: partidas of the competitive games (Mayor o menor…), per game and week.
  console.log("");
  if (report.partidas.length === 0) {
    console.log("Partidas: ninguna todavía.");
    return;
  }
  console.log("Partidas      juego    diarias  libres  personas");
  for (const row of report.partidas) {
    console.log(`${row.week}  ${row.juego.padEnd(7)}  ${String(row.daily).padStart(7)}  ${String(row.free).padStart(6)}  ${String(row.players).padStart(8)}`);
  }
};

/** FIL-I53-7: retos per week (sent to an account, by link, played, expired). */
const retosReport = async () => {
  const { loadRetosMetrics } = await import("../src/lib/juegos/retos/metrics");
  const weeks = await loadRetosMetrics(new Date(), Number(flag("semanas") ?? 6));
  console.log("");
  console.log("Retos        mandados  por enlace  jugados  vencidos");
  for (const row of weeks) {
    console.log(`${row.week}  ${String(row.sent).padStart(8)}  ${String(row.byLink).padStart(10)}  ${String(row.played).padStart(7)}  ${String(row.expired).padStart(8)}`);
  }
};

/** FIL-I55-4: people who play and partidas per person, per week, before and after the liga. */
const ligaReport = async () => {
  const { loadLigaMetrics } = await import("../src/lib/juegos/liga/metrics");
  const report = await loadLigaMetrics(new Date(), Number(flag("semanas") ?? 6), args.includes("--liga"));
  console.log("");
  console.log(`Liga (lanzamiento: semana del ${report.launchWeek ?? "—"})`);
  console.log("Semana       personas  partidas  por persona  liga");
  for (const row of report.weeks) {
    console.log(
      `${row.week}  ${String(row.players).padStart(8)}  ${String(row.partidas).padStart(8)}  ${(row.perPerson == null ? "—" : row.perPerson.toFixed(1)).padStart(11)}  ${row.phase ?? "—"}`,
    );
  }
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida (usa --env=<ruta al .env>).");
  }
  if (process.env.FILMIA_LOCAL_PG === "1") {
    const { installLocalPg } = await import("../src/db/local-pg");
    installLocalPg();
  }
  if (command === "metricas") {
    await metrics();
    await retosReport();
    await ligaReport();
  } else {
    await avisos();
  }
  const { closeLocalPg } = await import("../src/db/local-pg");
  await closeLocalPg().catch(() => undefined);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
