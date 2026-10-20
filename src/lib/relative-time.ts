const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

/** «hace 2 min», «hace 3 h», «ayer», «hace 4 días», then «el 12 oct» (shared lists, FIL-I18). */
export const relativeTimeEs = (when: Date | string, now = new Date()) => {
  const at = typeof when === "string" ? new Date(when) : when;
  const elapsed = Math.max(0, now.getTime() - at.getTime());
  if (elapsed < MINUTE) {
    return "hace un momento";
  }
  if (elapsed < HOUR) {
    return `hace ${Math.floor(elapsed / MINUTE)} min`;
  }
  if (elapsed < DAY) {
    return `hace ${Math.floor(elapsed / HOUR)} h`;
  }
  const days = Math.floor(elapsed / DAY);
  if (days === 1) {
    return "ayer";
  }
  if (days < 7) {
    return `hace ${days} días`;
  }
  return `el ${shortDate.format(at).replace(".", "")}`;
};
