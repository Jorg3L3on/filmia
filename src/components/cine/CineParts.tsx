import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FadeRail } from "@/components/cine/FadeRail";
import { ticketStub } from "@/lib/cine-core";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/** Slow-blinking marquee lights (off with prefers-reduced-motion). */
export const MarqueeBulbs = ({ count = 9, className }: { count?: number; className?: string }) => (
  <div className={cn("cine-bulbs", className)} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <span key={index} className="cine-bulb" style={{ "--bulb": index % 3 } as CSSProperties} />
    ))}
  </div>
);

const LONG_DATE = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Mexico_City",
});

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** «Cine» + today, under a row of marquee lights. */
export const CineMarquee = ({
  title = "Cine",
  subtitle,
  backHref,
  now = new Date(),
}: {
  title?: string;
  subtitle?: string;
  backHref?: string;
  now?: Date;
}) => (
  <header className="space-y-3">
    <MarqueeBulbs />
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {backHref ? (
          <Link href={backHref} className={cn("mb-1 inline-flex items-center gap-1 text-xs text-mist hover:text-paper", focusRing)}>
            <span aria-hidden="true">‹</span> Cine
          </Link>
        ) : null}
        <h1 className="cine-glow font-serif text-[2.25rem] leading-none text-paper sm:text-5xl">{title}</h1>
        <p className="mt-1.5 text-sm text-fog">{subtitle ?? capitalize(LONG_DATE.format(now))}</p>
      </div>
    </div>
  </header>
);

/** Section heading with its «Ver todo ›». */
export const CineSection = ({
  id,
  title,
  aside,
  moreHref,
  moreLabel = "Ver todo",
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  moreHref?: string;
  moreLabel?: string;
  children: ReactNode;
}) => (
  <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 space-y-3.5">
    {/* P1 (FIL-I23-4): the aside reads whole on a second line; «Ver todo» keeps its place with a 44 px zone. */}
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h2 id={`${id}-h`} className="font-serif text-[1.375rem] leading-tight text-paper">
          {title}
        </h2>
        {aside ? <p className="mt-0.5 text-[11px] leading-snug text-mist">{aside}</p> : null}
      </div>
      {moreHref ? (
        <Link
          href={moreHref}
          className={cn("-my-3 shrink-0 py-3 text-sm font-medium text-cine transition-opacity hover:opacity-80", focusRing)}
        >
          {moreLabel} <span aria-hidden="true">›</span>
        </Link>
      ) : null}
    </div>
    {children}
  </section>
);

/** «JUE 22» on a ticket stub. */
export const TicketStub = ({ day, className }: { day: string; className?: string }) => {
  const stub = ticketStub(day);
  return (
    <span className={cn("cine-stub", className)}>
      <span className="text-[10px] font-semibold tracking-[0.16em] text-cine">{stub.weekday}</span>
      <span className="font-serif text-2xl leading-none">{stub.day}</span>
    </span>
  );
};

/** A horizontal poster rail sized for Cine (≈3 posters on a phone), edges fading where more hides. */
export const CineRail = ({ label, children }: { label: string; children: ReactNode }) => (
  <FadeRail
    label={label}
    className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 touch-pan-x sm:gap-4"
  >
    {children}
  </FadeRail>
);

export const railItemClass = "w-[30vw] max-w-[9.5rem] shrink-0 snap-start sm:w-[9.5rem]";

/** A poster-shaped hole for empty sections. */
export const GhostPoster = ({ className }: { className?: string }) => (
  <div
    aria-hidden="true"
    className={cn("aspect-[2/3] rounded-poster border border-dashed border-white/15 bg-white/[0.02]", className)}
  />
);

/** «Actualizado hace 3 h · Reintentar» when the cron missed a run. */
export const StaleNotice = ({ label, href }: { label: string; href: string }) => (
  <p className="flex items-center gap-2 text-xs text-mist" role="status">
    <span>{label}</span>
    <span aria-hidden="true">·</span>
    <a href={href} className={cn("font-medium text-cine hover:opacity-80", focusRing)}>
      Reintentar
    </a>
  </p>
);
