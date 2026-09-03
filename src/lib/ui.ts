export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const fieldClass =
  "w-full rounded-sm border border-chrome bg-well px-3 py-2 text-sm text-white placeholder:text-faint focus:border-accent focus:outline-none";

export const btnPrimary =
  `inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover ${focusRing} focus-visible:outline-white`;

export const btnSecondary =
  `inline-flex items-center justify-center rounded-full bg-chrome px-4 py-2 text-sm text-white hover:bg-[#3a4452] ${focusRing}`;

export const btnGhost =
  `inline-flex items-center justify-center rounded-full border border-chrome px-4 py-2 text-sm text-fog hover:border-[#555] hover:text-white ${focusRing}`;

export const btnDanger =
  `inline-flex items-center justify-center rounded-full border border-danger-line px-4 py-2 text-sm text-danger hover:bg-danger-well ${focusRing} focus-visible:outline-danger`;

export const btnLink =
  `text-xs text-fog underline-offset-2 hover:text-white hover:underline ${focusRing}`;

export const wellClass = "rounded-md border border-line bg-surface";

export const eyebrowClass =
  "text-[11px] font-medium uppercase tracking-[0.22em] text-accent";

export const posterFrame =
  "overflow-hidden rounded-poster bg-well shadow-[0_10px_24px_rgba(0,0,0,0.45)]";
