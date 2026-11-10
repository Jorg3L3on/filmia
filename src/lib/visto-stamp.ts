/**
 * «VISTA · 9 nov» (FIL-I46-5): a rubber stamp drops over the screen once an entry lands in the
 * diary. Pure DOM like fly-to-nav; transform and opacity only; nothing with reduced motion.
 */

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «VISTA · 9 nov» for a local date. */
export const vistoStampLabel = (date: Date) => `VISTA · ${date.getDate()} ${MONTHS[date.getMonth()]}`;

/** Longest the stamp may stay if `animationend` never fires (hidden tab). */
const STAMP_FALLBACK_MS = 2400;

export const dropVistoStamp = (date = new Date()) => {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const stamp = document.createElement("div");
  stamp.setAttribute("aria-hidden", "true");
  stamp.className = "visto-stamp-drop";
  stamp.textContent = vistoStampLabel(date);
  document.body.appendChild(stamp);
  const remove = () => stamp.remove();
  stamp.addEventListener("animationend", remove, { once: true });
  window.setTimeout(remove, STAMP_FALLBACK_MS);
};
