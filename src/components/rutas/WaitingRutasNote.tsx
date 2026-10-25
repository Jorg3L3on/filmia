import Link from "next/link";
import { cn } from "@/lib/cn";
import { countRutasByStatus } from "@/lib/rutas/store";
import { focusRing } from "@/lib/ui";

/**
 * Quiero ver · the rutas waiting their turn (FIL-I26): one quiet line, only when there are
 * some. No count of days, no reminder: they wait as long as it takes.
 */
export const WaitingRutasNote = async ({ userId }: { userId: string }) => {
  const { espera } = await countRutasByStatus(userId);
  if (espera === 0) {
    return null;
  }
  return (
    <Link
      href="/rutas"
      className={cn(
        "press-scale inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[13px] text-fog hover:text-paper",
        focusRing,
      )}
    >
      {espera === 1 ? "Una ruta espera su turno" : `${espera} rutas esperan su turno`}
      <span aria-hidden="true">›</span>
    </Link>
  );
};
