import Link from "next/link";
import { NavLabel } from "@/components/NavOriginTracker";
import { MayorGame, MayorTopBar } from "@/components/juegos/MayorGame";
import { cn } from "@/lib/cn";
import { MAYOR_LENSES, parseMayorLens } from "@/lib/juegos/mayor/core";
import { openFreeMayor } from "@/lib/juegos/mayor/store";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mayor o menor" } as const;

type MayorSearchParams = Record<string, string | string[] | undefined>;

/**
 * Mayor o menor, free streak (FIL-I52-2, board Main): played until the first miss, with a record
 * per lens. The unfinished partida is picked up where it stopped. No dock while playing.
 */
export default async function MayorPage({ searchParams }: { searchParams: Promise<MayorSearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const lens = parseMayorLens(params.lente) ?? "imdb";
  const view = await openFreeMayor(userId, lens).catch(() => null);

  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
      <NavLabel label="Mayor o menor" />
      {view ? (
        <MayorGame key={view.partidaId} initialView={view} />
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
