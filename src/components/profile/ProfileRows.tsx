import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing, glassRowClass } from "@/lib/ui";

/** Perfil section: serif heading, optional count on the right, then its content. */
export const ProfileSection = ({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 space-y-3">
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={`${id}-h`} className="font-serif text-[1.375rem] leading-tight text-paper">
        {title}
      </h2>
      {aside ? <span className="text-xs text-mist">{aside}</span> : null}
    </div>
    {children}
  </section>
);

/** iOS-style inset group on the house glass row surface. */
export const ProfileGroup = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn(glassRowClass, "divide-y divide-line/80", className)}>{children}</div>
);

type ProfileRowProps = {
  icon: ReactNode;
  iconClassName?: string;
  label: ReactNode;
  value?: ReactNode;
  /** Second line under the label (e.g. why a row is not editable). */
  hint?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
};

const rowBase = "flex min-h-14 w-full items-center gap-3 py-2 pr-3.5 pl-4 text-left text-[15px] text-paper";

/** One row of a ProfileGroup: a button (with chevron) when it opens something, plain otherwise. */
export const ProfileRow = ({ icon, iconClassName, label, value, hint, onClick, ariaLabel }: ProfileRowProps) => {
  const body = (
    <>
      <span
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", iconClassName ?? "bg-chrome text-paper")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 shrink-0">
        <span className="block">{label}</span>
        {hint ? <span className="block text-xs text-mist">{hint}</span> : null}
      </span>
      {value ? <span className="ml-auto min-w-0 truncate text-right text-sm text-fog">{value}</span> : null}
      {onClick ? <ChevronIcon className={cn("size-4 shrink-0 text-faint", !value && "ml-auto")} /> : null}
    </>
  );

  if (!onClick) {
    return <div className={rowBase}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        rowBase,
        "transition-[background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:bg-white/[0.04] active:bg-white/[0.06]",
        focusRing,
        "focus-visible:-outline-offset-2",
      )}
    >
      {body}
    </button>
  );
};

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export const ChevronIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps} strokeWidth={2} className={className}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const MoonIcon = () => (
  <svg {...iconProps}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);

export const WeekendMoonIcon = () => (
  <svg {...iconProps}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    <path d="M17 3v3M15.5 4.5h3" />
  </svg>
);

export const PersonIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);

export const MailIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const LockIcon = () => (
  <svg {...iconProps}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps} strokeWidth={2.4} className={className}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export const SignOutIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps} strokeWidth={2} className={className}>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </svg>
);

/** Google «G» as a plain glyph on a light tile (not the brand logo). */
export const GoogleGlyph = () => <span className="font-sans text-sm font-bold leading-none">G</span>;
