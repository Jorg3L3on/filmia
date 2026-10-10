"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { dockSearch } from "@/lib/dock-search";

/** Same glass as the dock pill (kept here so the morph lands on identical material). */
const fieldGlassClass =
  "border border-white/14 bg-[rgb(12_16_24/0.72)] shadow-panel backdrop-blur-2xl backdrop-saturate-180 supports-[backdrop-filter]:bg-[rgb(12_16_24/0.45)] before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent";

/**
 * Buscar's field in the dock (mobile, at the top): magnifier, 16 px input (no iOS zoom),
 * ✕ to clear, Enter searches. Value and edits go through `dockSearch` to the
 * page's search (same 280 ms debounce and cache as before).
 */
export const DockSearchField = () => {
  const { query } = useSyncExternalStore(
    dockSearch.subscribe,
    dockSearch.getSnapshot,
    dockSearch.getServerSnapshot,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Arrived by tapping the dock disc: try to take focus. iOS only opens the
  // keyboard inside a user gesture, so after the navigation it may not; then
  // the first tap on the field opens it (the field is right under the thumb).
  useEffect(() => {
    if (dockSearch.takeFocusRequest()) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        dockSearch.submit();
        inputRef.current?.blur();
      }}
      className={cn(
        fieldGlassClass,
        "dock-field relative flex h-[3.375rem] min-w-0 flex-1 items-center gap-2.5 rounded-full pr-2 pl-4",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[1.125rem] shrink-0 text-mist"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-3.8-3.8" />
      </svg>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Buscar películas, series o directores</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => dockSearch.type(event.target.value)}
          placeholder="Películas, series o directores"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full min-w-0 bg-transparent text-base text-paper outline-none placeholder:text-mist"
        />
      </label>
      {query ? (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            dockSearch.type("");
            inputRef.current?.focus();
          }}
          className="press-scale flex size-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-paper hover:bg-white/18"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </form>
  );
};
