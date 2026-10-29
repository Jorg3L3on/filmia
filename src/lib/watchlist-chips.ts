import type { Platform } from "@/db";
import { formatRuntime, PLATFORM_SERVICE_LABEL, SERIES_STATUS_LABEL } from "@/lib/labels";
import type { NumberRange, WatchlistAdded, WatchlistFilterKey, WatchlistQuery } from "@/lib/watchlist-query";

/**
 * Words for Quiero ver's active filters (FIL-I34): the chips with ×, their VoiceOver names
 * and the empty state's exits. Pure.
 */

export type WatchlistChipNames = {
  genres: ReadonlyMap<number, string>;
  people: ReadonlyMap<number, string>;
};

const LANGUAGE_NAMES = (() => {
  try {
    return new Intl.DisplayNames(["es"], { type: "language" });
  } catch {
    return null;
  }
})();

/** «ja» → «Japonés». */
export const languageName = (code: string) => {
  const name = LANGUAGE_NAMES?.of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase("es") + name.slice(1);
};

export const ADDED_LABEL: Record<WatchlistAdded, string> = {
  week: "Esta semana",
  month: "Este mes",
  old: "Hace más de 6 meses",
};

const ADDED_CHIP: Record<WatchlistAdded, string> = {
  week: "Agregadas esta semana",
  month: "Agregadas este mes",
  old: "Agregadas hace +6 meses",
};

/** «Drama» / «Drama +1». */
const firstPlus = (names: string[]) =>
  names.length === 0 ? "" : names.length === 1 ? (names[0] ?? "") : `${names[0]} +${names.length - 1}`;

const minutes = (value: number) => formatRuntime(value) ?? `${value} min`;

export const durationLabel = (range: NumberRange) => {
  if (range.min == null && range.max != null) return `Hasta ${minutes(range.max)}`;
  if (range.max == null && range.min != null) return `Más de ${minutes(range.min)}`;
  return `${minutes(range.min ?? 0)}–${minutes(range.max ?? 0)}`;
};

/** «1990s», «Antes de 1990», «Desde 2000», «Años 1980–1999». */
export const yearsLabel = (range: NumberRange) => {
  const { min, max } = range;
  if (min != null && max != null && min % 10 === 0 && max === min + 9) return `${min}s`;
  if (min == null && max != null) return `Antes de ${max + 1}`;
  if (max == null && min != null) return `Desde ${min}`;
  if (min === max) return String(min);
  return `Años ${min}–${max}`;
};

export const imdbLabel = (query: Pick<WatchlistQuery, "imdbMin" | "votesFloor">) => {
  if (query.imdbMin != null && query.votesFloor) return `Nota ${query.imdbMin}+ · 1 000 votos`;
  if (query.imdbMin != null) return `Nota ${query.imdbMin}+`;
  return "1 000 votos o más";
};

export const filterChipLabel = (query: WatchlistQuery, key: WatchlistFilterKey, names: WatchlistChipNames): string => {
  switch (key) {
    case "kind":
      return query.kind === "SERIES" ? "Series" : "Películas";
    case "seriesStatus":
      return query.seriesStatus === "NONE" || !query.seriesStatus
        ? "Series sin estado"
        : `Series: ${SERIES_STATUS_LABEL[query.seriesStatus].toLocaleLowerCase("es")}`;
    case "platforms": {
      const label = firstPlus(query.platforms.map((platform) => PLATFORM_SERVICE_LABEL[platform]));
      return query.access === "rent" ? `${label} · renta o compra` : label;
    }
    case "short":
      return "Cortas";
    case "duration":
      return query.duration ? durationLabel(query.duration) : "Duración";
    case "years":
      return query.years ? yearsLabel(query.years) : "Año";
    case "imdb":
      return imdbLabel(query);
    case "genres":
      return firstPlus(query.genres.map((id) => names.genres.get(id) ?? "Género"));
    case "awarded":
      return "Premiadas";
    case "added":
      return query.added ? ADDED_CHIP[query.added] : "Agregada";
    case "languages":
      return firstPlus(query.languages.map(languageName));
    case "hideSnoozed":
      return "Sin «Ahora no»";
    case "withNote":
      return "Con nota mía";
    case "people":
      return firstPlus(query.people.map((id) => names.people.get(id) ?? "Director"));
  }
};

const MORE_NOUN: Partial<Record<WatchlistFilterKey, [string, string]>> = {
  genres: ["género", "géneros"],
  platforms: ["plataforma", "plataformas"],
  languages: ["idioma", "idiomas"],
  people: ["persona", "personas"],
};

/** VoiceOver: «Quitar filtro: Drama y 1 género más». */
export const filterChipSpoken = (query: WatchlistQuery, key: WatchlistFilterKey, names: WatchlistChipNames) => {
  const label = filterChipLabel(query, key, names);
  const noun = MORE_NOUN[key];
  const values = key === "genres" ? query.genres : key === "platforms" ? query.platforms : key === "languages" ? query.languages : key === "people" ? query.people : [];
  if (!noun || values.length < 2) return `Quitar filtro: ${label}`;
  const extra = values.length - 1;
  const first = filterChipLabel({ ...query, [key]: values.slice(0, 1), access: "flatrate" }, key, names);
  return `Quitar filtro: ${first} y ${extra} ${extra === 1 ? noun[0] : noun[1]} más`;
};

/** The «Mis plataformas» scope cell: «Netflix», «Netflix y Max», «3 plataformas»; none → «Mis plataformas». */
export const minePlatformsCellLabel = (platforms: readonly Platform[]) => {
  const [first, second] = platforms;
  if (platforms.length === 1 && first) return PLATFORM_SERVICE_LABEL[first];
  if (platforms.length === 2 && first && second) {
    return `${PLATFORM_SERVICE_LABEL[first]} y ${PLATFORM_SERVICE_LABEL[second]}`;
  }
  if (platforms.length > 2) return `${platforms.length} plataformas`;
  return "Mis plataformas";
};
