import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";

/**
 * FIL-I21-9 · Hoy on the phone, before and after the Asomo release. READ-ONLY.
 *
 * Three numbers from PickEvent, for the seven days before and the seven after `--deploy`:
 *   1. Nights with a «Vi esto» from Hoy: distinct (user, night) with a `watched` event whose
 *      lens is a Hoy lens (not Quiero ver's pin nor Buscar's). A night runs 06:00 → 06:00.
 *   2. Cards opened per session: `opened` events ÷ sessions, a session being a run of one
 *      user's Hoy events with no gap longer than 30 min.
 *   3. Swipes until deciding: `shown` + `skipped` events before the first `watched` or
 *      `opened` of a session (sessions that never decide are reported apart).
 *
 *   npm run metrics:hoy -- --env=<path to .env> --deploy=2026-10-22 [--days=7] [--include-qa]
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

/** Lenses that are not Hoy's deck (pins from Quiero ver and Buscar carry their own lens). */
const NOT_HOY_LENSES = ["quiero-ver", "buscar"];
const SESSION_GAP_MINUTES = 30;

type Window = { label: string; from: Date; to: Date };

type Row = Record<string, string | number | null>;

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida (usa --env=<ruta al .env>).");
  }
  const deployRaw = flag("deploy");
  if (!deployRaw) {
    throw new Error("Falta --deploy=<YYYY-MM-DD> (el día en que FIL-I21 llegó a producción).");
  }
  const deploy = new Date(deployRaw);
  if (Number.isNaN(deploy.getTime())) {
    throw new Error(`--deploy no es una fecha: ${deployRaw}`);
  }
  const days = Number(flag("days") ?? 7);
  const includeQa = args.includes("--include-qa");
  const { db } = await import("../src/db/index");
  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL).host} (solo lectura)`);
  console.log(`Deploy: ${deploy.toISOString().slice(0, 10)} · ${days} días antes y ${days} después\n`);

  const day = 24 * 60 * 60 * 1000;
  const windows: Window[] = [
    { label: "antes", from: new Date(deploy.getTime() - days * day), to: deploy },
    { label: "después", from: deploy, to: new Date(deploy.getTime() + days * day) },
  ];

  for (const window of windows) {
    const qaFilter = includeQa ? sql`` : sql`and u.email not like '%@filmia.local'`;
    const base = sql`
      from "PickEvent" e
      join "User" u on u.id = e."userId"
      where e."createdAt" >= ${window.from} and e."createdAt" < ${window.to}
        and (e.lens is null or e.lens not in (${sql.join(NOT_HOY_LENSES.map((lens) => sql`${lens}`), sql`, `)}))
        and e.kind in ('shown', 'skipped', 'opened', 'watched', 'not_tonight')
        ${qaFilter}`;

    // 1. Nights with a «Vi esto» from Hoy (and how many users had Hoy events at all).
    const nights = await db.execute(sql`
      select
        count(distinct (e."userId", date_trunc('day', e."createdAt" - interval '6 hours'))) filter (where e.kind = 'watched')::int as watched_nights,
        count(distinct (e."userId", date_trunc('day', e."createdAt" - interval '6 hours')))::int as active_nights,
        count(distinct e."userId")::int as users
      ${base}`);

    // 2 + 3. Sessions: runs of one user's events with no gap over 30 min.
    const sessions = await db.execute(sql`
      with ordered as (
        select e."userId", e.kind, e."createdAt",
          case when e."createdAt" - lag(e."createdAt") over (partition by e."userId" order by e."createdAt")
                 > make_interval(mins => ${SESSION_GAP_MINUTES}) or lag(e."createdAt") over (partition by e."userId" order by e."createdAt") is null
               then 1 else 0 end as starts
        ${base}
      ), numbered as (
        select *, sum(starts) over (partition by "userId" order by "createdAt") as session_no from ordered
      ), per_session as (
        select "userId", session_no,
          count(*) filter (where kind = 'opened')::int as opened,
          count(*) filter (where kind = 'watched')::int as watched,
          min("createdAt") filter (where kind in ('opened', 'watched')) as decided_at,
          count(*) filter (where kind in ('shown', 'skipped')) as swipes_total
        from numbered group by 1, 2
      ), swipes as (
        select p."userId", p.session_no,
          (select count(*) from numbered n
            where n."userId" = p."userId" and n.session_no = p.session_no
              and n.kind in ('shown', 'skipped') and n."createdAt" < p.decided_at)::int as swipes_before
        from per_session p where p.decided_at is not null
      )
      select
        (select count(*)::int from per_session) as sessions,
        (select coalesce(sum(opened), 0)::int from per_session) as opened,
        (select count(*)::int from per_session where decided_at is not null) as decided_sessions,
        (select coalesce(avg(swipes_before), 0)::numeric(10, 2) from swipes) as swipes_until_decision,
        (select coalesce(avg(swipes_total), 0)::numeric(10, 2) from per_session where decided_at is null) as swipes_without_decision`);

    const n = nights.rows[0] as Row;
    const s = sessions.rows[0] as Row;
    const sessionCount = Number(s.sessions);
    console.log(`— ${window.label} (${window.from.toISOString().slice(0, 10)} → ${window.to.toISOString().slice(0, 10)})`);
    console.log(`  usuarios con Hoy: ${n.users} · noches activas: ${n.active_nights}`);
    console.log(`  1. noches con «Vi esto» desde Hoy: ${n.watched_nights} (${Number(n.active_nights) ? ((Number(n.watched_nights) / Number(n.active_nights)) * 100).toFixed(1) : "0.0"} % de las activas)`);
    console.log(`  2. cartas abiertas por sesión: ${sessionCount ? (Number(s.opened) / sessionCount).toFixed(2) : "0.00"} (${s.opened} aperturas en ${sessionCount} sesiones)`);
    console.log(`  3. deslizamientos hasta decidir: ${s.swipes_until_decision} de media en ${s.decided_sessions} sesiones que decidieron · ${s.swipes_without_decision} en las que no\n`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
