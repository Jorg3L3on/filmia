"use client";

import { fieldClass, focusRing } from "@/lib/ui";

type TmdbSearchFormProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
};

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="5.5" />
    <path strokeLinecap="round" d="m15.5 15.5 4 4" />
  </svg>
);

export const TmdbSearchForm = ({
  query,
  onQueryChange,
  onSearch,
}: TmdbSearchFormProps) => (
  <form
    role="search"
    onSubmit={(event) => {
      event.preventDefault();
      onSearch();
    }}
    className="sticky top-16 z-30 bg-canvas/95 py-2 backdrop-blur"
  >
    <label className="relative block">
      <span className="sr-only">Buscar títulos en TMDB</span>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Interestelar, Dune, Severance…"
        className={`${fieldClass} border-accent/40 py-3 pr-12 text-base shadow-[0_0_0_3px_rgba(124,156,255,0.18)]`}
        autoComplete="off"
        autoFocus
      />
      <button
        type="submit"
        className={`${focusRing} absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-accent hover:bg-accent/10`}
        aria-label="Buscar"
      >
        <SearchIcon />
      </button>
    </label>
  </form>
);
