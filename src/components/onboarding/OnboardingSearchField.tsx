"use client";

import { cn } from "@/lib/cn";
import { fieldClass, focusRing } from "@/lib/ui";

type OnboardingSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  className?: string;
};

export const OnboardingSearchField = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  autoFocus = false,
  className,
}: OnboardingSearchFieldProps) => (
  <form
    role="search"
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
    className={cn("relative", className)}
  >
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <SearchIcon />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })}
        placeholder={placeholder}
        className={cn(
          fieldClass,
          "h-12 rounded-2xl border-white/10 bg-white/[0.06] pl-11 pr-11 text-base shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl placeholder:text-mist focus:border-accent/70 focus:bg-white/[0.08]",
        )}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Borrar búsqueda"
          className={cn(
            "absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-mist hover:bg-white/10 hover:text-paper",
            focusRing,
          )}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </label>
  </form>
);

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-mist"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="5.5" />
    <path strokeLinecap="round" d="m15.5 15.5 4 4" />
  </svg>
);
