import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { EstrenosGame } from "@/components/juegos/EstrenosGame";
import { mxToday } from "@/lib/cine-core";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { monthName, monthOf } from "@/lib/juegos/estrenos/core";
import { ensureEstrenos, loadEstrenos } from "@/lib/juegos/estrenos/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Quiniela de estrenos" } as const;

/**
 * Quiniela de estrenos (FIL-I55-1, board G-2-estrenos): the month's most awaited releases from
 * Cine. Everyone competes in one pool; others' forecasts arrive only after the person saves theirs.
 */
export default async function EstrenosPage() {
  const userId = await requireUserId();
  const now = new Date();
  await ensureEstrenos(now).catch((error) => console.error("[estrenos] ensure failed", error));
  const cards = await loadEstrenos(userId, now);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-10">
      <NavLabel label="Quiniela de estrenos" />
      <div className="flex items-center gap-3">
        <BackDisc href={JUEGOS_PATH} label="Volver a Extras" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-star">Entre todos · {monthName(monthOf(mxToday(now)))}</p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">Quiniela de estrenos</h1>
        </div>
      </div>
      <p className="text-sm text-fog">
        ¿Qué nota de IMDb va a tener dos semanas después de estrenarse? Se cierra el día del estreno y gana quien quede más cerca.
      </p>
      {cards.length > 0 ? (
        <EstrenosGame cards={cards} />
      ) : (
        <p className="rounded-[1.4rem] border border-line bg-surface p-4 text-sm text-fog">
          Todavía no hay estrenos grandes en cartelera para este mes ni el que sigue. Vuelve en unos días.
        </p>
      )}
      <p className="text-center text-xs text-fog">Los pronósticos de los demás se ven hasta que guardas el tuyo. Nada de esto entra a tu filmoteca.</p>
    </div>
  );
}
