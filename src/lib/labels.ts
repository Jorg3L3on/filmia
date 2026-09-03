import { Platform, TitleKind } from "@/generated/prisma/client";

export const TITLE_KIND_LABEL: Record<TitleKind, string> = {
  MOVIE: "Película",
  SERIES: "Serie",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  NETFLIX: "Netflix",
  PRIME: "Prime",
  MAX: "Max",
  DISNEY: "Disney+",
  CLARO: "Claro",
  APPLE: "Apple TV",
  MUBI: "MUBI",
};

export const PLATFORM_SERVICE_LABEL: Record<Platform, string> = {
  NETFLIX: "Netflix",
  PRIME: "Prime Video",
  MAX: "Max",
  DISNEY: "Disney+",
  CLARO: "Claro video",
  APPLE: "Apple TV",
  MUBI: "MUBI",
};

export const PLATFORM_WATCH_LABEL: Record<Platform, string> = {
  NETFLIX: "Ver ahora en Netflix",
  PRIME: "Ver ahora en Prime",
  MAX: "Ver ahora en Max",
  DISNEY: "Ver ahora en Disney+",
  CLARO: "Ver ahora en Claro",
  APPLE: "Ver ahora en Apple TV",
  MUBI: "Ver ahora en MUBI",
};

export const PLATFORM_CLASS: Record<Platform, string> = {
  NETFLIX: "bg-[#e50914] text-white",
  PRIME: "bg-[#00a8e1] text-[#041c2c]",
  MAX: "bg-[#002be7] text-white",
  DISNEY: "bg-[#113ccf] text-white",
  CLARO: "bg-[#da291c] text-white",
  APPLE: "bg-[#1d1d1f] text-white",
  MUBI: "bg-[#051c2c] text-white",
};

export const TITLE_KINDS = Object.keys(TITLE_KIND_LABEL) as TitleKind[];
export const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[];

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
