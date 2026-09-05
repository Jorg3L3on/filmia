const MONTH_PARAM_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_PARAM_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const asSingleString = (value: unknown) => {
  if (Array.isArray(value)) {
    const last = value.at(-1);
    return typeof last === "string" ? last : "";
  }

  return typeof value === "string" ? value : "";
};

/** Calendar value (`YYYY-MM-DD`) for `<input type="date">`. Dates are stored at noon UTC. */
export const toDateInput = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
};

/** Local calendar day — used as the default “vista el” when marking a title. */
export const todayDateInput = (now = new Date()) => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toMonthParam = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export const currentMonthParam = (now = new Date()) => todayDateInput(now).slice(0, 7);

export const parseMonthParam = (value: unknown, now = new Date()) => {
  const raw = asSingleString(value).trim();
  if (MONTH_PARAM_RE.test(raw)) {
    const year = Number(raw.slice(0, 4));
    if (year >= 1900 && year <= 2100) {
      return raw;
    }
  }

  return currentMonthParam(now);
};

export const hasExplicitMonthParam = (value: unknown) => {
  const raw = asSingleString(value).trim();
  if (!MONTH_PARAM_RE.test(raw)) {
    return false;
  }

  const year = Number(raw.slice(0, 4));
  return year >= 1900 && year <= 2100;
};

export const latestMonthWithEntries = <
  T extends { watchedAt: Date | string | null | undefined },
>(
  titles: T[],
  fallbackMonth: string,
) => {
  const months = [...groupTitlesByWatchedDay(titles).keys()]
    .map((isoDate) => monthFromIsoDate(isoDate))
    .sort();

  return months.at(-1) ?? fallbackMonth;
};

export const isValidIsoDate = (value: string) => {
  if (!DAY_PARAM_RE.test(value)) {
    return false;
  }

  return toDateInput(new Date(`${value}T12:00:00.000Z`)) === value;
};

export const parseDayParam = (value: unknown, monthParam: string) => {
  const raw = asSingleString(value).trim();
  if (!isValidIsoDate(raw)) {
    return null;
  }

  if (!raw.startsWith(`${monthParam}-`)) {
    return null;
  }

  return raw;
};

export const shiftMonthParam = (monthParam: string, delta: number) => {
  const year = Number(monthParam.slice(0, 4));
  const month = Number(monthParam.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return toMonthParam(date.getUTCFullYear(), date.getUTCMonth() + 1);
};

export const monthFromIsoDate = (isoDate: string) => isoDate.slice(0, 7);

export const formatMonthHeading = (monthParam: string) => {
  const year = Number(monthParam.slice(0, 4));
  const month = Number(monthParam.slice(5, 7));
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

export const formatMonthName = (monthParam: string) => {
  const year = Number(monthParam.slice(0, 4));
  const month = Number(monthParam.slice(5, 7));
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("es-MX", {
    month: "long",
    timeZone: "UTC",
  });
};

export const parseOptionalIsoDate = (value: unknown) => {
  const raw = asSingleString(value).trim();
  return isValidIsoDate(raw) ? raw : null;
};

export const isoDateToUtcNoon = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00.000Z`);

export const WEEKDAY_LABELS_SHORT = [
  "lun",
  "mar",
  "mié",
  "jue",
  "vie",
  "sáb",
  "dom",
] as const;

export type CalendarCell = {
  isoDate: string;
  day: number;
  inMonth: boolean;
};

/** Monday-first month grid (6 weeks). Uses civil UTC dates to match stored `watchedAt`. */
export const getMonthGrid = (monthParam: string): CalendarCell[] => {
  const year = Number(monthParam.slice(0, 4));
  const month = Number(monthParam.slice(5, 7));
  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month - 1, 1 - mondayOffset));
  const cells: CalendarCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start.getTime() + index * 86_400_000);
    const cellYear = date.getUTCFullYear();
    const cellMonth = date.getUTCMonth() + 1;
    const cellDay = date.getUTCDate();
    cells.push({
      isoDate: `${cellYear}-${String(cellMonth).padStart(2, "0")}-${String(cellDay).padStart(2, "0")}`,
      day: cellDay,
      inMonth: cellYear === year && cellMonth === month,
    });
  }

  return trimTrailingEmptyWeeks(cells);
};

export const trimTrailingEmptyWeeks = (cells: CalendarCell[]) => {
  const lastInMonth = cells.reduce(
    (last, cell, index) => (cell.inMonth ? index : last),
    0,
  );
  const weekCount = Math.max(4, Math.ceil((lastInMonth + 1) / 7));
  return cells.slice(0, weekCount * 7);
};

export const groupTitlesByWatchedDay = <
  T extends { watchedAt: Date | string | null | undefined },
>(
  titles: T[],
) => {
  const grouped = new Map<string, T[]>();

  for (const title of titles) {
    const isoDate = toDateInput(title.watchedAt);
    if (!isoDate) {
      continue;
    }

    const bucket = grouped.get(isoDate);
    if (bucket) {
      bucket.push(title);
    } else {
      grouped.set(isoDate, [title]);
    }
  }

  return grouped;
};

export const titlesInMonth = <
  T extends { watchedAt: Date | string | null | undefined },
>(
  titles: T[],
  monthParam: string,
) =>
  titles.filter((title) => toDateInput(title.watchedAt).startsWith(`${monthParam}-`));

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
