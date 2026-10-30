import { config as loadEnv } from "dotenv";

/**
 * FIL-I38 · Tutorial data for demo@filmia.local (and nobody else).
 *
 *   npm run db:seed:tutorial               # dry-run (default): prints what it would write, writes nothing
 *   npm run db:seed:tutorial -- --apply    # writes, in one transaction, then checks the counts
 *
 * Takes --env=<path to .env>. With FILMIA_LOCAL_PG=1 it talks to the local Postgres in DATABASE_URL.
 * Idempotent: a second run plans 0 writes. Refuses any write outside the demo account and its
 * fictitious friends (*.invalid). Production: take a Neon snapshot branch first.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const apply = args.includes("--apply");

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida.");
  }
  if (process.env.FILMIA_LOCAL_PG === "1") {
    const { installLocalPg } = await import("../src/db/local-pg");
    installLocalPg();
  }
  const { applyPlan, assertPlanScope, buildPlan, checkCounts, describeOp, readCounts, readState } = await import(
    "./demo-tutorial/plan"
  );

  const host = new URL(process.env.DATABASE_URL.replace(/^["']|["']$/g, "")).hostname;
  console.log(`Base: ${host} · modo: ${apply ? "APPLY (escribe)" : "dry-run (no escribe)"}`);

  const plan = buildPlan(await readState());
  assertPlanScope(plan.ops);

  for (const warning of plan.warnings) console.log(`! ${warning}`);
  for (const op of plan.ops) console.log(`  ${describeOp(op)}`);
  const byKind = Object.entries(
    plan.ops.reduce<Record<string, number>>((acc, op) => ({ ...acc, [op.op]: (acc[op.op] ?? 0) + 1 }), {}),
  );
  console.log(
    plan.ops.length === 0
      ? "Nada que cambiar: 0 escrituras."
      : `${plan.ops.length} escrituras planeadas (${byKind.map(([kind, n]) => `${kind} ${n}`).join(", ")}).`,
  );

  if (apply && plan.ops.length > 0) {
    const written = await applyPlan(plan.ops);
    console.log(`Aplicado: ${written} escrituras en una transacción.`);
  }

  const counts = await readCounts();
  console.log("Conteos del demo:", JSON.stringify(counts));
  const failures = checkCounts(counts);
  if (failures.length > 0) {
    for (const failure of failures) console.log(`✗ ${failure}`);
    if (apply) {
      process.exitCode = 1;
    } else {
      console.log("(dry-run: los conteos son los de hoy; --apply los completa)");
    }
  } else {
    console.log("✓ Listo para grabar.");
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
