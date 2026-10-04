import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/** Round companion to the Listas|Etiquetas pill — same chrome, same 46px height. */
export const segmentActionClass = cn(
  "group/action press-scale relative inline-flex size-[2.875rem] shrink-0 items-center justify-center rounded-full border border-chrome bg-well text-accent transition-colors duration-[var(--duration-hover)] hover:border-accent/60 hover:text-paper",
  focusRing,
);

export const SegmentPlusIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.25}
    strokeLinecap="round"
    aria-hidden="true"
    className={cn("size-5 transition-transform duration-[var(--duration-hover)]", className)}
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** Hover/focus label under a segment action. Decorative — the button's aria-label carries the name. */
export const SegmentActionTooltip = ({ label }: { label: string }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-20 translate-y-1 whitespace-nowrap rounded-lg border border-chrome bg-well px-2.5 py-1.5 text-xs font-medium text-paper opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition-[opacity,translate] duration-[var(--duration-hover)] group-hover/action:translate-y-0 group-hover/action:opacity-100 group-focus-visible/action:translate-y-0 group-focus-visible/action:opacity-100"
  >
    {label}
  </span>
);

/** Inert «+» so loading.tsx keeps the same row width as the page. */
export const SegmentActionPlaceholder = () => (
  <span aria-hidden="true" className={cn(segmentActionClass, "pointer-events-none opacity-60")}>
    <SegmentPlusIcon />
  </span>
);

export const PencilIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-4 transition-transform duration-[var(--duration-hover)] group-hover:-rotate-12"
  >
    <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);
