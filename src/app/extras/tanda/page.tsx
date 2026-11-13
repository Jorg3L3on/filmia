import { NavLabel } from "@/components/NavOriginTracker";
import { TandaGame } from "@/components/juegos/TandaGame";
import { epochLabel, epochsOfWeek } from "@/lib/juegos/tanda/core";
import { openTanda, tandaCorte, type TandaState } from "@/lib/juegos/tanda/store";
import { weekKeyOf } from "@/lib/juegos/core";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "La tanda" } as const;

/** La tanda (FIL-I50-4): the week's ten, dealt on the first visit of the week. No dock while playing. */
export default async function TandaPage() {
  const userId = await requireUserId();
  const now = new Date();
  const fallback: TandaState = { week: weekKeyOf(now), round: 1, epoch: epochLabel(epochsOfWeek(weekKeyOf(now)).main), cards: [] };
  const state = await openTanda(userId, now).catch(() => fallback);
  const finished = state.cards.length > 0 && state.cards.every((card) => card.answer);
  // A finished tanda opens on its Corte.
  const corte = finished ? await tandaCorte(userId, now).catch(() => null) : null;
  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
      <NavLabel label="La tanda" />
      <TandaGame key={state.week} initialState={state} initialCorte={corte} />
    </div>
  );
}
