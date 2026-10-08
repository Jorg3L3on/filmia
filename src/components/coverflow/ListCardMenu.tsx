"use client";

import Link from "next/link";
import { useId } from "react";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type ListCardMenuProps = {
  title: CoverflowTitle | null;
  onClose: () => void;
  onRemove: (title: CoverflowTitle) => void;
};

const itemClass = cn(
  "press-scale flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium text-paper hover:bg-chrome/60",
  focusRing,
);

/** Mantén pulsado el póster de una lista: Ver ficha · Mover a otra lista · Quitar de la lista. */
export const ListCardMenu = ({ title, onClose, onRemove }: ListCardMenuProps) => {
  const headingId = useId();
  return (
    <Sheet
      open={Boolean(title)}
      onClose={onClose}
      labelledBy={headingId}
      overlayLabel="Cerrar acciones"
      align="bottom"
      dragDismiss
      portal
    >
      {title ? (
        <>
          <div className="flex flex-col items-center px-5 pt-3">
            <SheetHandle />
            <div className="flex w-full items-center gap-3">
              <div className="w-10 shrink-0">
                <PosterImage name={title.name} posterPath={title.posterPath} sizes="40px" className="rounded-md" />
              </div>
              <h2 id={headingId} className="min-w-0 flex-1 truncate font-serif text-xl text-paper">
                {title.name}
              </h2>
            </div>
          </div>
          <div role="menu" aria-label={`Acciones de ${title.name}`} className="space-y-0.5 px-3 pb-2 pt-4" data-no-sheet-drag>
            <Link role="menuitem" href={`/titulos/${title.id}`} onClick={onClose} className={itemClass}>
              <Icon kind="ficha" /> Ver ficha
            </Link>
            <Link role="menuitem" href={`/titulos/${title.id}#listas`} onClick={onClose} className={itemClass}>
              <Icon kind="list" /> Mover a otra lista
            </Link>
            <span aria-hidden="true" className="mx-3 my-1 block h-px bg-white/8" />
            <button
              type="button"
              role="menuitem"
              onClick={() => onRemove(title)}
              className={cn(itemClass, "text-danger hover:bg-danger-well")}
            >
              <Icon kind="trash" /> Quitar de la lista
            </button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
};

const Icon = ({ kind }: { kind: "ficha" | "list" | "trash" }) => {
  const common = { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: kind === "trash" ? "text-danger" : "text-accent-hover" } as const;
  switch (kind) {
    case "ficha":
      return <svg {...common}><rect x="7" y="3.5" width="10" height="17" rx="2" /><path d="M10 7.5h4M10 11h4M10 14.5h2.5" /></svg>;
    case "list":
      return <svg {...common}><path d="M6 7h12M6 12h12M6 17h8" /></svg>;
    default:
      return <svg {...common}><path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10 11v5M14 11v5" /></svg>;
  }
};
