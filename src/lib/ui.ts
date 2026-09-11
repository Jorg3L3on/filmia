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

export const wellClass = "rounded-2xl border border-line bg-surface";

export const cardClass = "rounded-2xl border border-line bg-surface";

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

export const sheetOverlayClass = "absolute inset-0 bg-canvas-deep/60";

export const sheetPanelClass = (className?: string) =>
  cn(
    "relative z-10 flex w-full max-w-lg max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-0.75rem))] flex-col overflow-hidden rounded-t-sheet border border-line bg-well pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--sheet-shadow)] sheet-rise sm:rounded-sheet",
    className,
  );
