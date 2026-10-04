export const FICHA_CACHE_LIMIT = 8;
export const FICHA_STORAGE_KEY = "filmia.recent-fichas";
export const FICHA_OPENED_EVENT = "filmia:ficha-opened";

export type FichaStorage = Pick<Storage, "getItem" | "setItem">;

export const fichaHref = (titleId: string) => `/titulos/${titleId}`;

const parseStoredHrefs = (raw: string | null) => {
  if (!raw) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is string =>
        typeof value === "string" && value.startsWith("/titulos/"),
    );
  } catch {
    return [];
  }
};

export const readRecentFichaHrefs = (storage?: FichaStorage | null) => {
  if (!storage) {
    return [];
  }

  return parseStoredHrefs(storage.getItem(FICHA_STORAGE_KEY)).slice(0, FICHA_CACHE_LIMIT);
};

export const rememberOpenedFicha = (
  titleId: string,
  storage?: FichaStorage | null,
) => {
  const href = fichaHref(titleId);
  if (!titleId.trim() || !storage) {
    return [] as string[];
  }

  const next = [href, ...readRecentFichaHrefs(storage).filter((item) => item !== href)].slice(
    0,
    FICHA_CACHE_LIMIT,
  );
  storage.setItem(FICHA_STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const emitFichaOpened = (href: string) => {
  if (typeof window === "undefined" || !href) {
    return;
  }

  window.dispatchEvent(new CustomEvent(FICHA_OPENED_EVENT, { detail: href }));
};

export const browserFichaStorage = (): FichaStorage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};
