import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { VisteRitual } from "@/components/piezas/VisteRitual";
import { dealVisteToday } from "@/lib/piezas/viste";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "¿Las viste?" } as const;

/** P2 · «¿Las viste?»: today's three, ten seconds, three buttons (FIL-I26-3). */
export default async function LasVistePage() {
  const userId = await requireUserId();
  const cards = await dealVisteToday(userId).catch(() => []);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pb-10">
      <NavLabel label="¿Las viste?" />
      <div className="flex items-center gap-3">
        <BackDisc href="/" label="Volver a Hoy" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Diez segundos</p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">¿La viste?</h1>
        </div>
      </div>
      <VisteRitual cards={cards} />
    </div>
  );
}
