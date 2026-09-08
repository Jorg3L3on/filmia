import Link from "next/link";
import { cn } from "@/lib/cn";
import { eyebrowClass, iconButtonClass } from "@/lib/ui";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
};

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "Volver",
}: PageHeaderProps) => {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 max-w-2xl items-start gap-3">
        {backHref ? (
          <Link href={backHref} aria-label={backLabel} className={cn(iconButtonClass, "mt-1 shrink-0")}>
            ←
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
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
};
