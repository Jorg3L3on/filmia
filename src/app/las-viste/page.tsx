import Link from "next/link";
import { NavLabel } from "@/components/NavOriginTracker";
import { VisteRitual } from "@/components/piezas/VisteRitual";
import { cn } from "@/lib/cn";
import { dealVisteToday } from "@/lib/piezas/viste";
import { requireUserId } from "@/lib/session";
import { focusRing, glassIconClass } from "@/lib/ui";

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
        <Link
          href="/"
          aria-label="Volver a Hoy"
          className={cn(glassIconClass, "group size-10 after:absolute after:-inset-0.5 after:content-['']", focusRing)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Diez segundos</p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">¿La viste?</h1>
        </div>
      </div>
      <VisteRitual cards={cards} />
    </div>
  );
}
