import { cn } from "@/lib/cn";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const fieldClass =
  "w-full rounded-xl border border-chrome bg-well px-3 py-2 text-base text-paper placeholder:text-faint focus:border-accent focus:outline-none sm:text-sm";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";
export type SheetLayer = "preview" | "default" | "top";
export type SheetAlign = "bottom" | "center";

export const btnBase = `inline-flex items-center justify-center rounded-[var(--radius-button)] font-semibold transition disabled:opacity-60 ${focusRing}`;

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-ink hover:bg-accent-hover focus-visible:outline-white",
  secondary:
    "border border-accent bg-transparent text-accent hover:bg-accent/10",
  ghost: "bg-transparent font-medium text-paper hover:bg-chrome",
  danger:
    "bg-danger text-ink hover:brightness-110 focus-visible:outline-danger",
  success:
    "bg-success text-ink hover:bg-success-hover",
};

export const buttonSizeClass: Record<ButtonSize, string> = {
  sm: "h-8 min-h-8 px-3 text-xs",
  md: "h-10 min-h-10 px-4 text-sm",
  lg: "h-12 min-h-12 px-6 text-base",
};

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  className?: string;
};

export const buttonClass = ({
  variant = "primary",
  size = "md",
  pending = false,
  className,
}: ButtonClassOptions = {}) =>
  cn(
    btnBase,
    buttonVariantClass[variant],
    buttonSizeClass[size],
    pending && "cursor-wait opacity-60",
    className,
  );

export const btnPrimary = buttonClass({ variant: "primary" });
export const btnSecondary = buttonClass({ variant: "secondary" });
export const btnGhost = buttonClass({ variant: "ghost" });
export const btnDanger = buttonClass({ variant: "danger" });
export const btnSuccess = buttonClass({ variant: "success" });

export const btnLink =
  `text-xs text-fog underline-offset-2 hover:text-paper hover:underline ${focusRing}`;

export const iconButtonClass = cn(
  "inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] text-fog hover:bg-well hover:text-paper",
  focusRing,
);

const pillActionBase =
  "press-scale group inline-flex h-10 items-center gap-1.5 rounded-full pl-3 pr-4 text-sm font-semibold transition-colors duration-[var(--duration-hover)]";

/** Header actions on collection pages (Agregar / Editar). */
export const pillActionClass = {
  primary: cn(pillActionBase, "bg-accent text-ink hover:bg-accent-hover", focusRing),
  neutral: cn(
    pillActionBase,
    "border border-chrome bg-well text-paper hover:border-accent/50 hover:text-accent",
    focusRing,
  ),
} as const;

export const wellClass = "rounded-2xl border border-line bg-surface";

export const cardClass = "rounded-2xl border border-line bg-surface";

/*
 * Glass recipes (ported from MiCasa). One recipe per surface — reuse, don't
 * restyle ad hoc. Base CSS lives in globals.css (.glass-panel, .liquid-glass*).
 */

/** Frosted container: segmented frames, list rows, cards, sheets. Caller sets radius. */
export const glassPanelClass = "glass-panel liquid-glass relative border";

/** Round glass button: header back / actions, tab-bar «+». Caller sets size (size-10 / size-12). */
export const glassIconClass = cn(
  "press-scale relative inline-flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-paper/95 shadow-panel backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color,opacity] duration-[var(--duration-hover)] hover:border-white/30 hover:bg-white/15 active:opacity-90 [&_svg:not([class*='size-'])]:size-5",
  focusRing,
);

/** Capsule holding several icon buttons (search · sort · ⋯). */
export const glassGroupClass =
  "flex h-10 shrink-0 items-center overflow-hidden rounded-full border border-white/20 bg-white/10 px-0.5 shadow-panel backdrop-blur-xl backdrop-saturate-150";

export const glassGroupItemClass = cn(
  "relative inline-flex size-9 items-center justify-center rounded-full text-paper/90 transition-[background-color,opacity] duration-[var(--duration-hover)] hover:bg-white/12 active:bg-white/16 [&_svg]:size-[1.15rem]",
  focusRing,
);

export const glassGroupDividerClass = "mx-0.5 h-4 w-px bg-white/25";

/** Dropdown / popover panel (⋯ menu, tab-bar + menu). */
export const glassMenuPanelClass =
  "overflow-hidden rounded-2xl border border-white/10 bg-[var(--glass-fill-solid)] p-1.5 shadow-panel backdrop-blur-2xl backdrop-saturate-150";

export const glassMenuItemClass = cn(
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-paper hover:bg-white/5",
  focusRing,
);

export const glassMenuIconPillClass =
  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/25";

/** Active indicator behind the selected tab (tab bar, segmented tabs). */
export const glassPillClass = "liquid-glass liquid-glass-pill rounded-full";

/** Accent-glow variant of the active indicator (segmented tabs). */
export const auraPillClass = "liquid-glass liquid-glass-pill liquid-glass-pill-aura rounded-full";

export const eyebrowClass =
  "text-[11px] font-medium uppercase tracking-[0.22em] text-accent";

export const posterFrame =
  "overflow-hidden rounded-poster bg-well shadow-[0_10px_24px_rgba(0,0,0,0.45)]";

export const posterRowClass = "flex gap-4";

export const sheetLayerClass: Record<SheetLayer, string> = {
  preview: "z-sheet-preview",
  default: "z-50",
  top: "z-sheet-top",
};

export const toastLayerClass = "z-toast";

/** iPhone notch / home indicator — requires layout viewportFit: "cover" (JOR-220). */
export const safeAreaInsetTopClass = "pt-[env(safe-area-inset-top)]";
export const safeAreaInsetBottomClass = "pb-[env(safe-area-inset-bottom)]";
/** Mobile tab bar clearance above home indicator. */
export const safeAreaTabBarPadClass =
  "pb-[max(0.4rem,env(safe-area-inset-bottom))]";
/** Main column clears fixed BottomNav + home indicator (keep string on AppChrome for F3 verifies). */
export const safeAreaMainPadClass =
  "pb-[max(6rem,calc(5.5rem+env(safe-area-inset-bottom)))]";
/** Toasts sit above BottomNav; add inset so home indicator does not clip. */
export const safeAreaToastBottomClass =
  "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] sm:bottom-8";
/** Sticky under SiteHeader (h-12 / sm:h-14 + notch) — JOR-218. */
export const safeAreaStickyUnderHeaderClass =
  "top-[calc(3rem+env(safe-area-inset-top))] sm:top-[calc(3.5rem+env(safe-area-inset-top))]";
/** Landscape notch / Dynamic Island sides (JOR-218). */
export const safeAreaInsetXPadClass =
  "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]";

export const sheetAlignClass: Record<SheetAlign, string> = {
  bottom: "fixed inset-0 flex items-end justify-center",
  center: "fixed inset-0 flex items-end justify-center sm:items-center",
};

export const sheetOverlayClass = "absolute inset-0 bg-black/50";

/** Floating glass sheet: lifted off the edges on mobile like the dock, centered from sm. */
export const sheetPanelClass = (className?: string) =>
  cn(
    "glass-panel glass-sheet liquid-glass relative z-10 mx-1.5 mb-1.5 flex w-[calc(100%-0.75rem)] max-w-lg max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-0.75rem))] flex-col overflow-hidden rounded-sheet border pb-[max(1rem,env(safe-area-inset-bottom))] sheet-rise sm:mx-0 sm:w-full",
    className,
  );
