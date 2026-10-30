"use client";

import { useId, useState } from "react";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { BookmarkIcon, CheckIcon, CloseIcon, PinIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { fieldClass, focusRing, pillActionClass } from "@/lib/ui";
import type { WatchlistChipNames } from "@/lib/watchlist-chips";
import type { WatchlistCounter } from "@/lib/watchlist-facets";
import type { WatchlistQuery } from "@/lib/watchlist-query";
import {
  isSavableQuery,
  MAX_SAVED_VIEWS,
  matchesView,
  parseViewQuery,
  VIEW_NAME_MAX,
  viewSummary,
  type SavedView,
} from "@/lib/watchlist-views";

type WatchlistViewsSheetProps = {
  open: boolean;
  /** «Guardar como…» opens the sheet straight on the name field. */
  startSaving: boolean;
  views: readonly SavedView[];
  query: WatchlistQuery;
  count: WatchlistCounter;
  names: WatchlistChipNames;
  pending: boolean;
  onClose: () => void;
  onOpenView: (view: SavedView) => void;
  onPin: (view: SavedView, pinned: boolean) => void;
  onRemove: (view: SavedView) => void;
  /** Resolves with the error to show under the field, or `null` once saved. */
  onSave: (name: string, pin: boolean, done: (error: string | null) => void) => void;
};

/**
 * Vistas (FIL-I34-6, canvas board 17): the saved combinations with their counts; the pinned
 * one is the scope bar's third cell. «Guardar la vista actual» names what is on screen.
 */
export const WatchlistViewsSheet = ({
  open,
  startSaving,
  views,
  query,
  count,
  names,
  pending,
  onClose,
  onOpenView,
  onPin,
  onRemove,
  onSave,
}: WatchlistViewsSheetProps) => {
  const titleId = useId();
  const fieldId = useId();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPinned = views.some((view) => view.pinned);
  const savedAs = views.find((view) => matchesView(query, view)) ?? null;
  const savable = isSavableQuery(query) && !savedAs;
  const full = views.length >= MAX_SAVED_VIEWS;

  // Every opening starts clean; the first view is pinned by default (it has nowhere else to show).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSaving(startSaving && savable && !full);
      setName("");
      setPin(!hasPinned);
      setError(null);
    }
  }

  const submit = () =>
    onSave(name, pin, (message) => {
      setError(message);
      if (!message) {
        setSaving(false);
        setName("");
      }
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      overlayLabel="Cerrar vistas"
      layer="top"
      dragDismiss
      portal
      panelClassName="qv-sheet max-h-[min(45rem,92dvh)]"
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <SheetHandle />
        <h2 id={titleId} className="w-full text-left font-serif text-[1.625rem] text-paper">
          Vistas
        </h2>
        <p className="w-full text-left text-xs text-mist">Tus combinaciones de filtros y orden, guardadas en tu cuenta.</p>
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-labelledby={titleId} data-no-sheet-drag>
        {views.length === 0 ? (
          <li className="px-2 py-4 text-sm text-fog">Aún no guardas ninguna. Elige filtros u orden y guárdalos aquí.</li>
        ) : null}
        {views.map((view) => {
          const viewQuery = parseViewQuery(view.query);
          const current = query.view === view.id && matchesView(query, view);
          return (
            <li key={view.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenView(view)}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "press-scale flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors duration-[var(--duration-hover)]",
                  focusRing,
                  current ? "border-accent/60 bg-accent/15" : "border-transparent hover:bg-white/5",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium text-paper">{view.name}</span>
                  <span className="block truncate text-xs text-mist">{viewSummary(viewQuery, names)}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-fog">{count(viewQuery)}</span>
                {current ? <CheckIcon size={18} /> : null}
              </button>
              <button
                type="button"
                aria-pressed={view.pinned}
                aria-label={view.pinned ? `Desfijar ${view.name}` : `Fijar ${view.name} en el alcance`}
                disabled={pending}
                onClick={() => onPin(view, !view.pinned)}
                className={cn(
                  "press-scale inline-flex size-11 shrink-0 items-center justify-center rounded-full",
                  focusRing,
                  view.pinned ? "text-accent" : "text-mist hover:text-paper",
                )}
              >
                <PinIcon size={17} filled={view.pinned} />
              </button>
              <button
                type="button"
                aria-label={`Borrar la vista ${view.name}`}
                disabled={pending}
                onClick={() => onRemove(view)}
                className={cn("press-scale inline-flex size-11 shrink-0 items-center justify-center rounded-full text-mist hover:text-paper", focusRing)}
              >
                <CloseIcon size={14} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 border-t border-line px-5 pb-2 pt-3">
        {saving ? (
          <form
            className="space-y-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label htmlFor={fieldId} className="block text-sm font-medium text-paper">
              Nombre de la vista
            </label>
            <input
              id={fieldId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={VIEW_NAME_MAX}
              autoFocus
              enterKeyHint="done"
              placeholder="Clásicos"
              aria-describedby={`${fieldId}-hint`}
              aria-invalid={error ? true : undefined}
              className={cn(fieldClass, "h-11 text-base")}
            />
            <p id={`${fieldId}-hint`} className={cn("text-xs", error ? "text-danger" : "text-mist")} role={error ? "alert" : undefined}>
              {error ?? viewSummary(query, names)}
            </p>
            <label className="flex min-h-11 items-center gap-2.5 text-sm text-fog">
              <input type="checkbox" checked={pin} onChange={(event) => setPin(event.target.checked)} className="size-4 accent-[rgb(var(--accent-rgb))]" />
              Fijarla junto a Todo y Mis plataformas
            </label>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={pending} className={cn(pillActionClass.primary, "h-11 flex-1 justify-center")}>
                Guardar
              </button>
              <button type="button" onClick={() => setSaving(false)} className={cn(pillActionClass.neutral, "h-11 justify-center")}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <button
              type="button"
              disabled={!savable || full}
              onClick={() => setSaving(true)}
              className={cn(
                "press-scale flex min-h-12 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left disabled:opacity-50",
                focusRing,
              )}
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-accent">
                <BookmarkIcon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium text-paper">Guardar la vista actual</span>
                <span className="block truncate text-xs text-mist">
                  {savedAs
                    ? `Ya está guardada como «${savedAs.name}».`
                    : full
                      ? `Ya tienes ${MAX_SAVED_VIEWS}; borra una para guardar otra.`
                      : savable
                        ? viewSummary(query, names)
                        : "Elige filtros u orden primero."}
                </span>
              </span>
            </button>
            <p className="text-xs text-mist">La fijada aparece como tercera celda junto a Todo y Mis plataformas.</p>
            <button type="button" onClick={onClose} className={cn(pillActionClass.primary, "h-[50px] w-full justify-center text-[0.9375rem]")}>
              Listo
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
};
