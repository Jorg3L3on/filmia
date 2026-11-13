import Link from "next/link";
import type { ReactNode } from "react";
import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { MyRetosList, TeTocaBlock } from "@/components/juegos/RetosUi";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { RETAR_PATH, RETO_JUEGOS, type RetoJuegoId } from "@/lib/juegos/retos/core";
import { gustosReadiness } from "@/lib/juegos/retos/gustos";
import { listMyRetos, listTeToca } from "@/lib/juegos/retos/store";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Duelos" } as const;

const DuelRow = ({ juego, note, children }: { juego: RetoJuegoId; note?: string | null; children?: ReactNode }) => (
  <li>
    <Link
      href={`${RETAR_PATH}?juego=${juego}`}
      className={cn("flex min-h-[4.25rem] w-full items-center gap-3 border-t border-line py-2.5 text-left hover:bg-white/[0.03]", focusRing)}
      data-duelo={juego}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-base font-semibold text-paper">{RETO_JUEGOS[juego].name}</b>
        <span className="text-sm leading-snug text-fog">{note ?? RETO_JUEGOS[juego].line}</span>
      </span>
      {children ?? <span className="shrink-0 rounded-full border border-line bg-chrome px-2.5 py-1 text-xs font-semibold text-fog">Retar</span>}
    </Link>
  </li>
);

/**
 * Duelos (FIL-I53, «Duelos» on the cartel): retos waiting for the person, the three duels to send,
 * and the person's latest retos. Everyone competes in one pool; nobody plays live.
 */
export default async function DuelosPage() {
  const userId = await requireUserId();
  const now = new Date();
  const [teToca, mine, gustos] = await Promise.all([
    listTeToca(userId, now).catch(() => []),
    listMyRetos(userId, now).catch(() => []),
    gustosReadiness(userId).catch(() => null),
  ]);
  const gustosNote = !gustos?.notas ? "Enciende «Usar mis notas en juegos» en Perfil para jugarlo." : gustos.missing;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pb-10">
      <NavLabel label="Duelos" />
      <div className="flex items-center gap-3">
        <BackDisc href={JUEGOS_PATH} label="Volver a Extras" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Extras</p>
          <h1 className="font-serif text-[1.9rem] font-semibold leading-none text-paper">Duelos</h1>
        </div>
      </div>
      <TeTocaBlock items={teToca} now={now} />
      <section aria-labelledby="duelos-retar">
        <h2 id="duelos-retar" className="text-lg font-semibold text-paper">
          Uno contra uno
        </h2>
        <p className="mt-0.5 text-sm text-fog">Juegas tú y le mandas lo mismo a alguien. Tiene 48 horas.</p>
        <ul className="mt-1.5 border-b border-line">
          <DuelRow juego="mayor" />
          <DuelRow juego="trivia" />
          <DuelRow juego="gustos" note={gustosNote} />
        </ul>
      </section>
      {mine.length > 0 ? (
        <section aria-labelledby="duelos-mios">
          <h2 id="duelos-mios" className="mb-1.5 text-lg font-semibold text-paper">
            Tus retos
          </h2>
          <MyRetosList items={mine} />
        </section>
      ) : null}
    </div>
  );
}
