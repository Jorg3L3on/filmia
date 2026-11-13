import Link from "next/link";
import { NavLabel } from "@/components/NavOriginTracker";
import { MayorDailyResult } from "@/components/juegos/MayorDailyResult";
import { LensChip, MayorGame, MayorTopBar } from "@/components/juegos/MayorGame";
import { cn } from "@/lib/cn";
import { MAYOR_LENSES, MAYOR_PATH } from "@/lib/juegos/mayor/core";
import { loadDailyResult, openDailyMayor } from "@/lib/juegos/mayor/store";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "La diaria · Mayor o menor" } as const;

/**
 * La diaria (FIL-I52-3, board M-3-diaria): ten pairs, the same for every account on a Mexico City
 * day, one attempt played to the tenth. Once over, the page is the result and the day table.
 */
export default async function MayorDailyPage() {
  const userId = await requireUserId();
  const now = new Date();
  const opened = await openDailyMayor(userId, now).catch(() => null);

  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
      <NavLabel label="La diaria" />
      {opened?.status === "ok" && opened.view.finished ? (
        <MayorDailyResult result={await loadDailyResult(userId, opened.view, now)} />
      ) : opened?.status === "ok" ? (
        <MayorGame key={opened.view.partidaId} initialView={opened.view} />
      ) : (
        <div className="flex flex-col gap-6" data-mayor="sin-diaria">
          <MayorTopBar
            eyebrow="La diaria"
            title="Mayor o menor"
            backHref={MAYOR_PATH}
            chip={opened ? <LensChip>{MAYOR_LENSES[opened.lens].short}</LensChip> : undefined}
          />
          <p className="rounded-2xl border border-line bg-surface px-4 py-5 text-[15px] leading-snug text-fog">
            {opened
              ? "Hoy no hay suficientes películas conocidas para armar la diaria. Mañana lo intentamos otra vez."
              : "No pudimos abrir la diaria ahora. Vuelve a intentarlo en un momento."}
          </p>
          <Link href={MAYOR_PATH} className={cn("self-start text-sm font-semibold text-accent", focusRing)}>
            Jugar racha libre
          </Link>
        </div>
      )}
    </div>
  );
}
