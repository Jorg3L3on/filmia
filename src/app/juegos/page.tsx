import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { JuegosPortada, type TandaRowState } from "@/components/juegos/JuegosPortada";
import { JuegosSeen } from "@/components/juegos/JuegosSeen";
import { mxToday } from "@/lib/cine-core";
import { JUEGOS, portadaOf } from "@/lib/juegos/core";
import { readTanda } from "@/lib/juegos/tanda/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Juegos" } as const;

type JuegosSearchParams = Record<string, string | string[] | undefined>;

/** Juegos (FIL-I50-2): the cartel. Reached only from Hoy (its button and its second act). */
export default async function JuegosPage({ searchParams }: { searchParams: Promise<JuegosSearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const now = new Date();
  const portada = portadaOf(JUEGOS, mxToday(now));
  const tanda = await readTanda(userId, now).catch(() => null);
  const answered = tanda?.cards.filter((card) => card.answer).length ?? 0;
  const total = tanda?.cards.length ?? 0;
  const tandaRow: TandaRowState = {
    chip: total === 0 || answered === 0 ? "Nueva" : answered >= total ? "Terminada" : `${answered} de ${total}`,
    fresh: total === 0 || answered === 0,
    posters: (tanda?.cards ?? []).flatMap((card) => (card.posterPath ? [card.posterPath] : [])).slice(0, 2),
  };
  const desde = typeof params.desde === "string" ? params.desde : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pb-10">
      <NavLabel label="Juegos" />
      <JuegosSeen entry={desde} />
      <div className="flex items-center gap-3">
        <BackDisc href="/" label="Volver a Hoy" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Hoy</p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">Juegos</h1>
        </div>
      </div>
      <JuegosPortada portada={portada} tanda={tandaRow} />
    </div>
  );
}
