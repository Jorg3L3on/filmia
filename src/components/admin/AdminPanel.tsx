import {
  OMDB_DAILY_LIMIT,
  quotaTone,
  type AdminUsers,
  type ApiUsageDay,
  type QuotaTone,
} from "@/lib/admin-stats";
import { cn } from "@/lib/cn";
import { relativeTimeEs } from "@/lib/relative-time";

const numberFormat = new Intl.NumberFormat("en-US");
const dayFormat = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", timeZone: "UTC" });
const todayFormat = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const signupFormat = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

const TONE_TEXT: Record<QuotaTone, string> = { ok: "text-success", warn: "text-star", danger: "text-danger" };
const TONE_BAR: Record<QuotaTone, string> = { ok: "bg-success", warn: "bg-star", danger: "bg-danger" };

const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.06em] text-fog";
const card = "flex flex-col gap-2.5 rounded-2xl border border-line bg-well p-4";

const dayLabel = (day: string, index: number) =>
  index === 0 ? "Hoy" : dayFormat.format(new Date(`${day}T12:00:00Z`)).replace(".", "");

/** FIL-I37 · Uso de Filmia: accounts, their counts and today's OMDb/TMDB calls. */
export function AdminPanel({ usage, users, now }: { usage: ApiUsageDay[] | null; users: AdminUsers; now: Date }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-[0.08em] text-fog">Admin · solo tú</p>
          <h1 className="font-serif text-[2.1rem] font-semibold leading-tight text-paper">Uso de Filmia</h1>
        </div>
        <p className="text-sm text-fog">Hoy, {todayFormat.format(now).replace(".", "")} · días en UTC</p>
      </header>

      <ApiUsageSection usage={usage} />
      <UsersSection users={users} now={now} />
    </div>
  );
}

function ApiUsageSection({ usage }: { usage: ApiUsageDay[] | null }) {
  const today = usage?.[0] ?? null;
  const omdb = today?.omdb ?? 0;
  const tone = quotaTone(omdb);
  const share = Math.min(100, Math.round((omdb / OMDB_DAILY_LIMIT) * 100));

  return (
    <section aria-labelledby="admin-apis" className="flex flex-col gap-3">
      <h2 id="admin-apis" className={sectionTitle}>
        APIs hoy
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className={card}>
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-paper">OMDb</span>
            {today ? <span className={cn("text-sm font-semibold", TONE_TEXT[tone])}>{share} %</span> : null}
          </div>
          {today ? (
            <>
              <p className="text-[1.75rem] font-semibold tabular-nums text-paper">
                {numberFormat.format(omdb)}{" "}
                <span className="text-base font-normal text-fog">/ {numberFormat.format(OMDB_DAILY_LIMIT)}</span>
              </p>
              <div
                role="img"
                aria-label={`${omdb} de ${OMDB_DAILY_LIMIT} llamadas usadas`}
                className="h-2 overflow-hidden rounded-full bg-line"
              >
                <div className={cn("h-full rounded-full", TONE_BAR[tone])} style={{ width: `${share}%` }} />
              </div>
              <p className={cn("text-[13px]", omdb >= OMDB_DAILY_LIMIT ? "text-danger" : "text-fog")}>
                {omdb >= OMDB_DAILY_LIMIT
                  ? "Límite alcanzado: OMDb responde 401 hasta medianoche UTC."
                  : `Quedan ${numberFormat.format(OMDB_DAILY_LIMIT - omdb)} · se reinicia a medianoche UTC`}
              </p>
            </>
          ) : (
            <MissingCounter />
          )}
        </div>
        <div className={card}>
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-paper">TMDB</span>
            <span className="text-[13px] text-fog">sin límite diario</span>
          </div>
          {today ? (
            <p className="text-[1.75rem] font-semibold tabular-nums text-paper">
              {numberFormat.format(today.tmdb)} <span className="text-base font-normal text-fog">llamadas</span>
            </p>
          ) : (
            <MissingCounter />
          )}
        </div>
        <div className={cn(card, "gap-1")}>
          <table className="w-full border-collapse text-sm tabular-nums">
            <caption className="pb-1 text-left text-[13px] font-semibold text-fog">Últimos 7 días</caption>
            <thead>
              <tr className="text-right text-fog">
                <th scope="col" className="py-1 text-left font-medium">
                  Día
                </th>
                <th scope="col" className="py-1 font-medium">
                  OMDb
                </th>
                <th scope="col" className="py-1 font-medium">
                  TMDB
                </th>
              </tr>
            </thead>
            <tbody>
              {usage ? (
                usage.map((row, index) => (
                  <tr key={row.day} className="text-right text-paper">
                    <td className="py-1 text-left">{dayLabel(row.day, index)}</td>
                    <td className={cn("py-1", row.omdb >= OMDB_DAILY_LIMIT * 0.7 && TONE_TEXT[quotaTone(row.omdb)])}>
                      {numberFormat.format(row.omdb)}
                    </td>
                    <td className="py-1">{numberFormat.format(row.tmdb)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-1 text-faint">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MissingCounter() {
  return (
    <>
      <p className="text-[1.75rem] font-semibold text-faint">—</p>
      <p className="text-[13px] text-fog">Sin contador todavía: falta la tabla ApiUsage (0026).</p>
    </>
  );
}

const th = "border-b border-line py-2 font-medium";
const td = "border-b border-surface py-3";

function UsersSection({ users, now }: { users: AdminUsers; now: Date }) {
  return (
    <section aria-labelledby="admin-users" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 id="admin-users" className={sectionTitle}>
          Usuarios · {users.rows.length}
        </h2>
        <span className="text-xs text-faint md:hidden" aria-hidden="true">
          desliza →
        </span>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full border-collapse whitespace-nowrap text-sm tabular-nums">
          <thead>
            <tr className="text-fog">
              <th scope="col" className={cn(th, "sticky left-0 bg-canvas pr-4 text-left")}>
                Email
              </th>
              <th scope="col" className={cn(th, "pr-4 text-left")}>
                Nombre
              </th>
              <th scope="col" className={cn(th, "px-4 text-right")}>
                Títulos
              </th>
              <th scope="col" className={cn(th, "px-4 text-right")}>
                Vistos
              </th>
              <th scope="col" className={cn(th, "px-4 text-right")}>
                Gustados
              </th>
              <th scope="col" className={cn(th, "px-4 text-right")}>
                Listas
              </th>
              <th scope="col" className={cn(th, "px-4 text-left")}>
                Última actividad
              </th>
              <th scope="col" className={cn(th, "pl-4 text-left")}>
                Alta
              </th>
            </tr>
          </thead>
          <tbody>
            {users.rows.map((user) => (
              <tr key={user.id} className="text-paper">
                <td className={cn(td, "sticky left-0 max-w-[170px] truncate bg-canvas pr-4 md:max-w-none")}>{user.email}</td>
                <td className={cn(td, "pr-4 text-mist")}>{user.name?.trim() || "—"}</td>
                <td className={cn(td, "px-4 text-right")}>{user.titles}</td>
                <td className={cn(td, "px-4 text-right")}>{user.watched}</td>
                <td className={cn(td, "px-4 text-right")}>{user.liked}</td>
                <td className={cn(td, "px-4 text-right")}>{user.lists}</td>
                <td className={cn(td, "px-4", user.lastActiveAt ? "text-paper" : "text-faint")}>
                  {user.lastActiveAt ? relativeTimeEs(user.lastActiveAt, now) : "—"}
                </td>
                <td className={cn(td, "pl-4 text-fog")}>{signupFormat.format(user.createdAt).replace(".", "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-faint">
        {users.lastActiveMissing
          ? "Última actividad muestra «—» hasta aplicar 0025. "
          : "Ordenado por última actividad. "}
        Gustados = 4 estrellas o más. Listas = las que creó (sin las 5 fijas).
      </p>
    </section>
  );
}
