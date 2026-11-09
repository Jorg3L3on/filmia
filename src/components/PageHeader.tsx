import Link from "next/link";
import { cn } from "@/lib/cn";
import { eyebrowClass, glassIconClass } from "@/lib/ui";

/**
 * The one «atrás» of every sub-page (FIL-I44-17): a 40 px glass disc, 44 px to the touch (FIL-I25-4).
 * PageHeader, Cine's sub-pages and ¿La viste? share it.
 */
export const BackDisc = ({ href, label, className }: { href: string; label: string; className?: string }) => (
  <Link
    href={href}
    aria-label={label}
    className={cn(
      glassIconClass,
      "group size-10 shrink-0 after:absolute after:-inset-0.5 after:content-[''] hover:text-accent",
      className,
    )}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5 transition-transform duration-[var(--duration-hover)] group-hover:-translate-x-0.5"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  </Link>
);

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Keep actions on the title row (compact round buttons) instead of wrapping below on mobile. */
  inlineActions?: boolean;
};

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "Volver",
  inlineActions = false,
}: PageHeaderProps) => {
  return (
    <div
      className={cn(
        "flex justify-between gap-3 sm:gap-4",
        inlineActions ? "items-start" : "flex-wrap items-end",
      )}
    >
      <div className="flex min-w-0 max-w-2xl flex-1 items-start gap-3">
        {backHref ? (
          <BackDisc href={backHref} label={backLabel} className="mt-0.5 md:mt-1.5" />
        ) : null}
        <div className="min-w-0 space-y-2">
          {eyebrow ? <p className={eyebrowClass}>{eyebrow}</p> : null}
          <h1 className="text-balance font-serif text-4xl leading-tight tracking-tight text-paper md:text-[2.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-fog">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div
          className={cn(
            "flex items-center gap-2 sm:gap-3",
            inlineActions
              ? "mt-0.5 shrink-0 md:mt-1.5"
              : "w-full flex-wrap sm:w-auto sm:justify-end",
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
};
