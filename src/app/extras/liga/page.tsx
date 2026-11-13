import Link from "next/link";
import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { RetoAvatar } from "@/components/juegos/RetosUi";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { daysLeftInWeek, LIGA_PATH, LIGA_POINTS, ligaDetail, weekLabel } from "@/lib/juegos/liga/core";
import { loadLiga, parseLigaTab, type LigaTab } from "@/lib/juegos/liga/store";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "La liga" } as const;

type LigaSearchParams = Record<string, string | string[] | undefined>;

const TABS: { id: LigaTab; label: string }[] = [
  { id: "semana", label: "Esta semana" },
  { id: "pasada", label: "La pasada" },
  { id: "historico", label: "Histórico" },
];

const RULES: { label: string; points: string }[] = [
  { label: "Jugar una diaria", points: `hasta ${LIGA_POINTS.diaria}` },
  { label: "Ganar un duelo", points: String(LIGA_POINTS.dueloGanado) },
  { label: "Empatar un duelo", points: String(LIGA_POINTS.dueloEmpate) },
  { label: "Perder un duelo (por jugarlo)", points: String(LIGA_POINTS.dueloPerdido) },
  { label: "Línea de bingo", points: String(LIGA_POINTS.bingoLinea) },
];

/**
 * La liga de la semana (FIL-I55-3, board Comp-4-liga): every account in one table, computed on
 * read from what was played. Starts from zero every Monday (Mexico City); no prizes.
 */
export default async function LigaPage({ searchParams }: { searchParams: Promise<LigaSearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const tab = parseLigaTab(params.tab);
  const now = new Date();
  const { week, rows } = await loadLiga(userId, tab, now);
  const left = daysLeftInWeek(now);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-10">
      <NavLabel label="La liga" />
      <div className="flex items-center gap-3">
        <BackDisc href={JUEGOS_PATH} label="Volver a Extras" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-star">{week ? weekLabel(week) : "Desde noviembre"}</p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">La liga</h1>
        </div>
        {tab === "semana" ? (
          <span className="shrink-0 rounded-full border border-star/50 bg-star/10 px-2.5 py-1 text-xs font-semibold text-star">
            {left === 1 ? "Último día" : `Quedan ${left} días`}
          </span>
        ) : null}
      </div>

      <nav aria-label="Periodo" className="flex gap-2">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "semana" ? LIGA_PATH : `${LIGA_PATH}?tab=${item.id}`}
            aria-current={item.id === tab ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center rounded-full border px-3.5 text-sm font-semibold",
              item.id === tab ? "border-accent/60 bg-accent/15 text-accent" : "border-line bg-chrome text-fog",
              focusRing,
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {rows.length > 0 ? (
        <ol className="rounded-[1.4rem] border border-line bg-surface px-4 py-1.5" aria-label="Tabla">
          {rows.map((row, index) => (
            <li
              key={row.userId}
              className={cn("flex min-h-14 items-center gap-3 py-2", index > 0 && "border-t border-line", row.me && "-mx-2 rounded-xl bg-white/[0.04] px-2")}
              data-liga-row={row.me ? "me" : "other"}
            >
              <span className={cn("w-5 text-center font-serif text-lg font-semibold tabular-nums", row.place === 1 ? "text-star" : "text-fog")}>{row.place}</span>
              <RetoAvatar initial={row.initial} seed={row.name} me={row.me} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-[15px] font-semibold text-paper">{row.name}</b>
                <span className="truncate text-xs text-fog">{ligaDetail(row)}</span>
              </span>
              <span className="font-serif text-xl font-semibold tabular-nums text-paper">{row.points}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-[1.4rem] border border-line bg-surface p-4 text-sm text-fog">
          {tab === "semana" ? "Nadie ha jugado esta semana. Juega una diaria o reta a alguien y entras a la tabla." : "Nadie jugó en ese periodo."}
        </p>
      )}

      <section aria-labelledby="liga-reglas" className="rounded-[1.4rem] border border-line bg-surface p-4">
        <h2 id="liga-reglas" className="text-base font-semibold text-paper">
          Cómo se suman puntos
        </h2>
        <dl className="mt-2.5 flex flex-col gap-1.5 text-sm">
          {RULES.map((rule) => (
            <div key={rule.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-fog">{rule.label}</dt>
              <dd className="font-semibold tabular-nums text-paper">{rule.points}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="text-sm text-fog">El lunes empieza de cero. No hay premios: es para ver quién jugó más. Solo aparece quien jugó, con su primer nombre.</p>
    </div>
  );
}
