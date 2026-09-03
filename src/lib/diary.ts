const toUtcDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

export type DiaryTitle = {
  id: string;
  name: string;
  year: number | null;
  rating: number | null;
  posterPath: string | null;
  watchedAt: Date | string | null;
};

export type DiaryDay = {
  day: number;
  titles: DiaryTitle[];
};

export type DiaryMonth = {
  key: string;
  year: number;
  month: number;
  label: string;
  daysInMonth: number;
  startWeekday: number;
  days: Map<number, DiaryTitle[]>;
};

const monthLabel = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 1)).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export const buildDiaryMonths = (titles: DiaryTitle[]): DiaryMonth[] => {
  const grouped = new Map<string, DiaryTitle[]>();

  for (const title of titles) {
    const watchedAt = toUtcDate(title.watchedAt);
    if (!watchedAt) {
      continue;
    }

    const year = watchedAt.getUTCFullYear();
    const month = watchedAt.getUTCMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const bucket = grouped.get(key);

    if (bucket) {
      bucket.push(title);
    } else {
      grouped.set(key, [title]);
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, monthTitles]) => {
      const year = Number(key.slice(0, 4));
      const month = Number(key.slice(5, 7)) - 1;
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const startWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
      const days = new Map<number, DiaryTitle[]>();

      for (const title of monthTitles) {
        const day = toUtcDate(title.watchedAt)!.getUTCDate();
        const existing = days.get(day);
        if (existing) {
          existing.push(title);
        } else {
          days.set(day, [title]);
        }
      }

      return {
        key,
        year,
        month,
        label: monthLabel(year, month),
        daysInMonth,
        startWeekday,
        days,
      };
    });
};

export const titlesWithoutWatchDate = (titles: DiaryTitle[]) =>
  titles.filter((title) => !toUtcDate(title.watchedAt));
