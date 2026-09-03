/** Calendar value (`YYYY-MM-DD`) for `<input type="date">`. Dates are stored at noon UTC. */
export const toDateInput = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : "";

/** Local calendar day — used as the default “vista el” when marking a title. */
export const todayDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatWatchedDate = (
  value: Date,
  style: "long" | "short" = "long",
) =>
  value.toLocaleDateString("es-MX", {
    year: "numeric",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  });
