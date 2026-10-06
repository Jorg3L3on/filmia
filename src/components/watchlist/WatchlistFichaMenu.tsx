"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import {
  ClockIcon,
  FichaIcon,
  ListIcon,
  MoonIcon,
  PenIcon,
  TrashIcon,
  UpIcon,
} from "@/components/watchlist/icons";
import type { FichaView } from "@/components/watchlist/types";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type WatchlistFichaMenuProps = {
  ficha: FichaView | null;
  onClose: () => void;
  onTonight: (ficha: FichaView) => void;
  onMoveToTop: (ficha: FichaView) => void;
  onNote: (ficha: FichaView) => void;
  onNotTonight: (ficha: FichaView) => void;
  onRemove: (ficha: FichaView) => void;
};

const itemClass = cn(
  "press-scale flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium text-paper hover:bg-chrome/60",
  focusRing,
);

const Pill = ({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "warn" | "danger" }) => (
  <span
    className={cn(
      "inline-flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
      tone === "accent" && "bg-accent/15 text-accent ring-accent/25",
      tone === "warn" && "bg-[#f0b35a]/12 text-[#f0b35a] ring-[#f0b35a]/30",
      tone === "danger" && "bg-danger-well text-danger ring-danger-line",
    )}
  >
    {children}
  </span>
);

/** Mantén pulsada una ficha (o ⋯): ficha · esta noche · subir · anotar · mover · ahora no · quitar. */
export const WatchlistFichaMenu = ({
  ficha,
  onClose,
  onTonight,
  onMoveToTop,
  onNote,
  onNotTonight,
  onRemove,
}: WatchlistFichaMenuProps) => {
  const headingId = useId();
  return (
    <Sheet
      open={Boolean(ficha)}
      onClose={onClose}
      labelledBy={headingId}
      overlayLabel="Cerrar acciones"
      align="bottom"
      dragDismiss
      portal
    >
      {ficha ? (
        <>
          <div className="flex flex-col items-center px-5 pt-3">
            <SheetHandle />
            <div className="flex w-full items-center gap-3">
              <div className="w-10 shrink-0">
                <PosterImage name={ficha.name} posterPath={ficha.posterPath} sizes="40px" className="rounded-md" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id={headingId} className="truncate font-serif text-xl text-paper">
                  {ficha.name}
                </h2>
                <p className="truncate text-xs text-fog">
                  {ficha.meta} · #{ficha.rank} en tu lista
                </p>
              </div>
            </div>
          </div>
          <div role="menu" aria-label={`Acciones de ${ficha.name}`} className="space-y-0.5 px-3 pb-2 pt-4" data-no-sheet-drag>
            <Link role="menuitem" href={`/titulos/${ficha.id}`} onClick={onClose} className={itemClass}>
              <Pill><FichaIcon /></Pill> Ver ficha
            </Link>
            <button type="button" role="menuitem" onClick={() => onTonight(ficha)} className={itemClass}>
              <Pill><MoonIcon size={18} /></Pill>
              <span>
                {ficha.pinned ? "Elegida para esta noche" : "Esta noche"}
                <span className="block text-xs font-normal text-fog">
                  {ficha.pinned ? "Ya está primera en Hoy" : "Aparece primera en Hoy"}
                </span>
              </span>
            </button>
            {ficha.rank > 1 ? (
              <button type="button" role="menuitem" onClick={() => onMoveToTop(ficha)} className={itemClass}>
                <Pill><UpIcon /></Pill>
                <span>
                  Subir al principio
                  <span className="block text-xs font-normal text-fog">#{ficha.rank} → #1</span>
                </span>
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={() => onNote(ficha)} className={itemClass}>
              <Pill><PenIcon /></Pill>
              <span>
                {ficha.queueNote ? "Editar tu nota" : "Anotar por qué la quiero ver"}
                {ficha.queueNote ? (
                  <span className="block truncate text-xs font-normal italic text-fog">«{ficha.queueNote}»</span>
                ) : null}
              </span>
            </button>
            <Link role="menuitem" href={`/titulos/${ficha.id}#listas`} onClick={onClose} className={itemClass}>
              <Pill><ListIcon /></Pill> Mover a una lista
            </Link>
            <span aria-hidden="true" className="mx-3 my-1 block h-px bg-white/8" />
            <button type="button" role="menuitem" onClick={() => onNotTonight(ficha)} className={itemClass}>
              <Pill tone="warn"><ClockIcon size={18} /></Pill>
              <span>
                Ahora no
                <span className="block text-xs font-normal text-fog">Dos semanas fuera de Hoy; la lista la conserva</span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onRemove(ficha)}
              className={cn(itemClass, "text-danger hover:bg-danger-well")}
            >
              <Pill tone="danger"><TrashIcon /></Pill> Quitar de Quiero ver
            </button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
};
