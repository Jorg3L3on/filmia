"use client";

import Image from "next/image";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import { tmdbBackdropUrl, tmdbPosterUrl, type TmdbCatalogResult } from "@/lib/tmdb";
import { focusRing } from "@/lib/ui";

type LocalTitle = {
  titleId: string;
  inWatchlist: boolean;
  watched: boolean;
};

export type SearchAddDestination = "watchlist" | "watched";

type SearchPreviewSheetProps = {
  result: TmdbCatalogResult;
  local: LocalTitle | null;
  pending: boolean;
  pendingAction?: SearchAddDestination | "open" | null;
  onClose: () => void;
  onAdd: (destination: SearchAddDestination) => void;
  onOpen: () => void;
};

export const SearchPreviewSheet = ({
  result,
  local,
  pending,
  pendingAction = null,
  onClose,
  onAdd,
  onOpen,
}: SearchPreviewSheetProps) => {
  const hero =
    tmdbBackdropUrl(result.backdropPath) ?? tmdbPosterUrl(result.posterPath, "w500");
  const meta = [
    result.year ? String(result.year) : null,
    TITLE_KIND_LABEL[result.kind],
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet
      open
      onClose={onClose}
      label={result.name}
      overlayLabel="Cerrar vista previa"
      layer="preview"
      portal
      dragDismiss
      panelClassName="bg-surface"
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle />
      </div>
      <div className="relative aspect-[16/10] bg-well">
        {hero ? (
          <Image
            src={hero}
            alt=""
            fill
            sizes="512px"
            className="object-cover"
            unoptimized={hero.includes("image.tmdb.org")}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas/70 text-paper",
            focusRing,
          )}
          aria-label="Cerrar"
        >
          ×
        </button>
        <div className="absolute inset-x-0 bottom-0 space-y-2 px-5 pb-4">
          <h2 className="font-serif text-3xl text-paper">{result.name}</h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-fog">
            {meta}
            {local ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
                Ya en Filmia
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5" data-no-sheet-drag>
        {result.overview ? (
          <p className="line-clamp-4 text-sm leading-6 text-fog">{result.overview}</p>
        ) : (
          <p className="text-sm text-mist">Sin sinopsis en TMDB.</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          <SheetAction
            label={
              pending && pendingAction === "watchlist"
                ? "Agregando…"
                : local?.inWatchlist
                  ? "En Quiero ver"
                  : "Quiero ver"
            }
            disabled={pending || Boolean(local?.inWatchlist)}
            onClick={() => onAdd("watchlist")}
          >
            <WatchlistIcon />
          </SheetAction>
          <SheetAction
            label={
              pending && pendingAction === "watched"
                ? "Guardando…"
                : local?.watched
                  ? "Vista"
                  : "Visto"
            }
            disabled={pending || Boolean(local?.watched)}
            onClick={() => onAdd("watched")}
          >
            <WatchedIcon />
          </SheetAction>
          <SheetAction
            label={pending && pendingAction === "open" ? "Abriendo…" : "Ficha"}
            primary
            disabled={pending || Boolean(local?.titleId.startsWith("pending:"))}
            onClick={onOpen}
          >
            <OpenIcon />
          </SheetAction>
        </div>
      </div>
    </Sheet>
  );
};

const SheetAction = ({
  label,
  children,
  onClick,
  disabled,
  primary = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-xs font-medium uppercase tracking-[0.12em] transition",
      focusRing,
      primary
        ? "bg-accent text-ink disabled:opacity-50"
        : "border border-chrome bg-well text-fog hover:text-paper disabled:opacity-40",
    )}
  >
    <span
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full",
        primary ? "bg-ink/10" : "bg-canvas",
      )}
    >
      {children}
    </span>
    {label}
  </button>
);

const WatchlistIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z"
    />
  </svg>
);

const WatchedIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 12.2 2.3 2.3 4.7-5" />
  </svg>
);

const OpenIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16 16 8M9 8h7v7" />
  </svg>
);
