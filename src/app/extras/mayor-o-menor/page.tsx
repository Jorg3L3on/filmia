import Link from "next/link";
import { NavLabel } from "@/components/NavOriginTracker";
import { MayorGame, MayorTopBar } from "@/components/juegos/MayorGame";
import { cn } from "@/lib/cn";
import { mxToday } from "@/lib/cine-core";
import { MAYOR_DAILY_PATH, MAYOR_ID, MAYOR_LENSES, parseMayorLens } from "@/lib/juegos/mayor/core";
import { openFreeMayor, readDailyMayor, type MayorView } from "@/lib/juegos/mayor/store";
import { bestScoresByLens } from "@/lib/juegos/partidas";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mayor o menor" } as const;

type MayorSearchParams = Record<string, string | string[] | undefined>;

/**
 * Mayor o menor, free streak (FIL-I52-2, FIL-I56-3, board Main): played until the first miss, with
 * a record per lens. The unfinished partida is picked up where it stopped. No dock while playing.
 */
/** «La diaria de hoy» in the end screen (board M-3-fin), only while today's is not finished. */
const DailyDoor = ({ daily }: { daily: MayorView | null }) => (
  <Link
    href={MAYOR_DAILY_PATH}
    className={cn("mt-1.5 flex min-h-[3.75rem] items-center gap-3 rounded-[1.375rem] border border-line bg-surface px-3 py-2.5 text-left", focusRing)}
    data-mayor="puerta-diaria"
  >
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <b className="text-[15px] font-semibold text-paper">La diaria de hoy</b>
      <span className="truncate text-sm text-fog">{daily ? `Llevas ${daily.answers.length} de ${daily.total}` : "Diez pares, los mismos para todos"}</span>
    </span>
    <span className="shrink-0 rounded-full border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent">{daily ? "Seguir" : "Jugar"}</span>
  </Link>
);

export default async function MayorPage({ searchParams }: { searchParams: Promise<MayorSearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const lens = parseMayorLens(params.lente) ?? "imdb";
  const [view, daily] = await Promise.all([
    openFreeMayor(userId, lens).catch(() => null),
    readDailyMayor(userId, mxToday()).catch(() => null),
  ]);
  // After the partida exists, so its lens counts as played.
  const records = await bestScoresByLens(userId, MAYOR_ID).catch(() => new Map<string, { best: number; played: number }>());

  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
      <NavLabel label="Mayor o menor" />
      {view ? (
        <MayorGame
          key={view.partidaId}
          initialView={view}
          endExtra={daily?.finished ? undefined : <DailyDoor daily={daily} />}
          lensRecords={Object.fromEntries([...records].map(([id, record]) => [id, record.best]))}
        />
      ) : (
        <div className="flex flex-col gap-6" data-mayor="sin-partida">
          <MayorTopBar eyebrow={MAYOR_LENSES[lens].label} title="Mayor o menor" />
          <p className="rounded-2xl border border-line bg-surface px-4 py-5 text-[15px] leading-snug text-fog">
            No pudimos armar una partida ahora. Vuelve a intentarlo en un momento.
          </p>
          <Link href={`?lente=${lens}`} className={cn("self-start text-sm font-semibold text-accent", focusRing)}>
            Intentar de nuevo
          </Link>
        </div>
      )}
    </div>
  );
}
