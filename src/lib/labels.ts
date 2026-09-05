import { Platform, SeriesStatus, TitleKind } from "@/generated/prisma/browser";

export const TITLE_KIND_LABEL: Record<TitleKind, string> = {
  MOVIE: "Película",
  SERIES: "Serie",
};

export const SERIES_STATUS_LABEL: Record<SeriesStatus, string> = {
  WATCHING: "Viendo",
  FINISHED: "Terminada",
  DROPPED: "Abandonada",
};

export const SERIES_STATUS_CLASS: Record<SeriesStatus, string> = {
  WATCHING: "bg-accent text-ink",
  FINISHED: "bg-chrome text-white",
  DROPPED: "border border-danger-line bg-danger-well text-danger",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  NETFLIX: "Netflix",
  PRIME: "Prime",
  DISNEY: "Disney+",
  MAX: "Max",
  APPLE: "Apple TV+",
  PARAMOUNT: "Paramount+",
  CRUNCHYROLL: "Crunchyroll",
  VIX: "ViX",
  CLARO: "Claro",
  MUBI: "MUBI",
  PLUTO: "Pluto TV",
  AMCPLUS: "AMC+",
  CURIOSITY: "Curiosity",
  LIONSGATE: "Lionsgate",
};

export const PLATFORM_SERVICE_LABEL: Record<Platform, string> = {
  NETFLIX: "Netflix",
  PRIME: "Prime Video",
  DISNEY: "Disney+",
  MAX: "Max",
  APPLE: "Apple TV+",
  PARAMOUNT: "Paramount+",
  CRUNCHYROLL: "Crunchyroll",
  VIX: "ViX",
  CLARO: "Claro video",
  MUBI: "MUBI",
  PLUTO: "Pluto TV",
  AMCPLUS: "AMC+",
  CURIOSITY: "Curiosity Stream",
  LIONSGATE: "Lionsgate Play",
};

export const PLATFORM_WATCH_LABEL: Record<Platform, string> = {
  NETFLIX: "Ver ahora en Netflix",
  PRIME: "Ver ahora en Prime",
  DISNEY: "Ver ahora en Disney+",
  MAX: "Ver ahora en Max",
  APPLE: "Ver ahora en Apple TV+",
  PARAMOUNT: "Ver ahora en Paramount+",
  CRUNCHYROLL: "Ver ahora en Crunchyroll",
  VIX: "Ver ahora en ViX",
  CLARO: "Ver ahora en Claro",
  MUBI: "Ver ahora en MUBI",
  PLUTO: "Ver ahora en Pluto TV",
  AMCPLUS: "Ver ahora en AMC+",
  CURIOSITY: "Ver ahora en Curiosity Stream",
  LIONSGATE: "Ver ahora en Lionsgate Play",
};

export const PLATFORM_CLASS: Record<Platform, string> = {
  NETFLIX: "bg-[#e50914] text-white",
  PRIME: "bg-[#00a8e1] text-[#041c2c]",
  DISNEY: "bg-[#113ccf] text-white",
  MAX: "bg-[#002be7] text-white",
  APPLE: "bg-[#1d1d1f] text-white",
  PARAMOUNT: "bg-[#0064ff] text-white",
  CRUNCHYROLL: "bg-[#f47521] text-white",
  VIX: "bg-[#1a1a1a] text-[#ffe600]",
  CLARO: "bg-[#da291c] text-white",
  MUBI: "bg-[#051c2c] text-white",
  PLUTO: "bg-[#1a103c] text-[#ffd200]",
  AMCPLUS: "bg-[#0a0a0a] text-white",
  CURIOSITY: "bg-[#ff6b00] text-white",
  LIONSGATE: "bg-[#1c1408] text-[#d4a017]",
};

export const TITLE_KINDS = Object.keys(TITLE_KIND_LABEL) as TitleKind[];
export const SERIES_STATUSES = Object.keys(SERIES_STATUS_LABEL) as SeriesStatus[];
export const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[];

export const formatSeriesSeason = (season: number | null | undefined) => {
  if (season == null) {
    return null;
  }

  return `Temporada ${season}`;
};

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const formatRating = (rating: number | null | undefined) => {
  if (rating == null) {
    return "Sin nota";
  }

  const fullStars = Math.floor(rating / 2);
  const hasHalf = rating % 2 === 1;
  return `${"★".repeat(fullStars)}${hasHalf ? "½" : ""} ${rating}/10`;
};

export const formatRuntime = (minutes: number | null | undefined) => {
  if (minutes == null || minutes <= 0) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

export const formatImdbRating = (rating: number | null | undefined) => {
  if (rating == null) {
    return null;
  }

  return `IMDb ${rating.toFixed(1)}/10`;
};

export const posterTone = (name: string) => {
  const tones = [
    "from-emerald-800 to-slate-900",
    "from-amber-800 to-stone-950",
    "from-sky-800 to-slate-950",
    "from-rose-800 to-zinc-950",
    "from-violet-800 to-slate-950",
    "from-orange-800 to-neutral-950",
  ] as const;

  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[hash % tones.length];
};
