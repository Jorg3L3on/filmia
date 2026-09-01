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
