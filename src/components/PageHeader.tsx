import Link from "next/link";
import { cn } from "@/lib/cn";
import { eyebrowClass, glassIconClass } from "@/lib/ui";

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
          <Link
            href={backHref}
            aria-label={backLabel}
            className={cn(
              glassIconClass,
              "group mt-0.5 size-10 hover:text-accent md:mt-1.5",
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
        ) : null}
        <div className="min-w-0 space-y-2">
          {eyebrow ? <p className={eyebrowClass}>{eyebrow}</p> : null}
          <h1 className="truncate font-serif text-4xl tracking-tight text-paper md:text-[2.75rem]">
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
