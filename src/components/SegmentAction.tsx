import { cn } from "@/lib/cn";
import { glassIconClass } from "@/lib/ui";

/** Round glass header action (46px), e.g. the Listas «+». */
export const segmentActionClass = cn(
  glassIconClass,
  "group/action size-[2.875rem] text-accent hover:text-paper",
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
    className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-20 translate-y-1 whitespace-nowrap rounded-lg border border-white/10 bg-[var(--glass-fill-solid)] px-2.5 py-1.5 text-xs font-medium text-paper opacity-0 shadow-panel backdrop-blur-xl transition-[opacity,translate] duration-[var(--duration-hover)] group-hover/action:translate-y-0 group-hover/action:opacity-100 group-focus-visible/action:translate-y-0 group-focus-visible/action:opacity-100"
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
