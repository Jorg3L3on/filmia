import { Button } from "@/components/Button";

export type EmptyVariant =
  | "watchlist"
  | "historial"
  | "listas"
  | "buscar"
  | "generic";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  variant?: EmptyVariant;
};

export const EmptyState = ({
  title,
  description,
  actionHref,
  actionLabel,
  variant = "generic",
}: EmptyStateProps) => {
  return (
    <div className="px-4 py-10 text-center">
      <EmptyIllustration variant={variant} />
      <p className="mt-6 font-serif text-2xl text-paper sm:text-3xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fog">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Button href={actionHref} size="lg" className="mt-6">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};

const EmptyIllustration = ({ variant }: { variant: EmptyVariant }) => {
  if (variant === "historial") {
    return (
      <div className="mx-auto flex h-40 w-40 items-end justify-center" aria-hidden="true">
        <svg viewBox="0 0 160 160" className="h-full w-full">
          <ellipse cx="80" cy="138" rx="36" ry="8" fill="var(--accent)" opacity="0.28" />
          <path
            d="M48 118h64v8H48zM56 62h12v56H56zm36 0h12v56H92z"
            fill="#1c2228"
            stroke="var(--accent)"
            strokeWidth="1.4"
          />
          <path d="M52 54h56l-6 8H58z" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.4" />
          <circle cx="80" cy="44" r="10" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.4" />
        </svg>
      </div>
    );
  }

  if (variant === "listas") {
    return (
      <div className="mx-auto flex h-36 w-44 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 176 144" className="h-full w-full">
          <rect x="28" y="36" width="52" height="78" rx="8" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.4" opacity="0.7" />
          <rect x="62" y="24" width="56" height="86" rx="8" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.6" />
          <rect x="96" y="40" width="52" height="74" rx="8" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.4" opacity="0.7" />
          <path d="M84 48v28l10-6 10 6V48" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
        </svg>
      </div>
    );
  }

  if (variant === "buscar") {
    return (
      <div className="mx-auto flex h-36 w-36 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 144 144" className="h-full w-full">
          <circle cx="64" cy="64" r="26" fill="none" stroke="var(--accent)" strokeWidth="2" />
          <path d="m84 84 22 22" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          <rect x="28" y="28" width="22" height="32" rx="4" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.2" opacity="0.55" />
          <rect x="94" y="24" width="20" height="30" rx="4" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.2" opacity="0.55" />
        </svg>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-40 w-52 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 208 160" className="h-full w-full">
        <rect x="18" y="36" width="52" height="78" rx="8" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.3" opacity="0.55" />
        <rect x="78" y="22" width="58" height="92" rx="8" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.7" />
        <rect x="140" y="38" width="50" height="74" rx="8" fill="#161a1f" stroke="var(--accent)" strokeWidth="1.3" opacity="0.55" />
        {variant === "watchlist" ? (
          <path
            d="M100 48h14.5a1 1 0 0 1 1 1v28L107 69.5 99 77V49a1 1 0 0 1 1-1Z"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.6"
          />
        ) : (
          <circle cx="107" cy="64" r="8" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
        )}
        <path d="M36 128c6 6 14 10 22 6" fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0.5" />
        <rect x="154" y="120" width="16" height="12" rx="2" fill="#161a1f" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
        <rect x="160" y="112" width="16" height="12" rx="2" fill="#161a1f" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
      </svg>
    </div>
  );
};
