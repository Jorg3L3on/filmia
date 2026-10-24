"use client";

import { useId } from "react";
import { Button } from "@/components/Button";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { StartRutaButton } from "@/components/universo/StartRutaButton";
import type { BridgeReveal } from "@/lib/universo/store";

/**
 * U4 · «Vi esto» joined two films by different directors through someone already in your
 * universe: the moment the map grows a bridge. Once per person.
 */
export const BridgeSheet = ({ bridge, onClose }: { bridge: BridgeReveal | null; onClose: () => void }) => {
  const headingId = useId();
  return (
    <Sheet open={Boolean(bridge)} onClose={onClose} labelledBy={headingId} overlayLabel="Cerrar" align="bottom" dragDismiss portal>
      {bridge ? (
        <div className="flex flex-col gap-4 px-5 pb-5 pt-3 text-center">
          <SheetHandle />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-affinity">Nuevo puente</p>
          <div className="flex items-center justify-center gap-2 text-[13px] text-paper/85" aria-hidden="true">
            <span className="rounded-full border border-line px-3 py-1.5">{bridge.films[1]}</span>
            <span className="h-px w-6 bg-affinity" />
            <span className="rounded-full border border-affinity px-3 py-1.5 text-paper">{bridge.personName}</span>
            <span className="h-px w-6 bg-affinity" />
            <span className="rounded-full border border-line px-3 py-1.5">{bridge.films[0]}</span>
          </div>
          <h2 id={headingId} className="font-serif text-2xl leading-tight text-paper">
            {bridge.personName}, {bridge.roleLabel}
          </h2>
          <p className="text-[14px] leading-snug text-paper/85">{bridge.line}</p>
          <div className="flex flex-col gap-2">
            {bridge.ruta ? <StartRutaButton sourceKey={bridge.ruta.sourceKey} label={bridge.ruta.title} /> : null}
            <Button href="/perfil/universo" variant="secondary" size="md" onClick={onClose}>
              Ver el universo
            </Button>
            <Button variant="ghost" size="md" onClick={onClose}>
              Listo
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
};
