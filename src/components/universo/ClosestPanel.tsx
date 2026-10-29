import { Button } from "@/components/Button";
import type { UniversoView } from "@/lib/universo/store";
import { VISTE_PATH } from "@/lib/piezas/core";

const ISLAND_WORD = (n: number) => (n === 1 ? "Una isla" : n === 2 ? "Dos islas" : n === 3 ? "Tres islas" : `${n} islas`);

/**
 * U2 · islands before bridges: with no bridge yet, the hook is closing the smallest island (the
 * director closest to complete) and the next film it needs. With bridges, the same panel reads
 * «Más cerca de cerrarse».
 */
export const ClosestPanel = ({ view }: { view: UniversoView }) => {
  const { universo, closest } = view;
  if (!closest) {
    return null;
  }
  const noBridges = universo.bridges.length === 0 && universo.islands.length > 1;
  return (
    <section aria-labelledby="universo-closest" className="rounded-3xl border border-accent/50 bg-surface px-4 py-4">
      <h3 id="universo-closest" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        {noBridges ? `${ISLAND_WORD(universo.islands.length)}, ningún puente` : "Más cerca de cerrarse"}
      </h3>
      <p className="mt-1.5 text-[14px] leading-snug text-paper/90">
        {noBridges ? "Nadie se repite entre tus películas. El gancho no es unirlas: es cerrar la más chica. " : ""}
        <strong className="font-semibold text-paper">{closest.node.name}</strong> tiene {closest.node.total} y ya llevas{" "}
        {closest.node.count}.
      </p>
      {closest.next ? (
        <p className="mt-2 text-[13px] text-fog">
          Sigue <span className="text-paper">{closest.next.name}</span>
          {closest.next.platformLabel ? ` · ${closest.next.platformLabel}` : ""} · {closest.node.name}{" "}
          {closest.node.personIds.length > 1 ? "pasan" : "pasa"} a{" "}
          {closest.node.count + 1} de {closest.node.total}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        <Button href={VISTE_PATH} variant="ghost" size="md">
          ¿La viste?
        </Button>
      </div>
    </section>
  );
};
