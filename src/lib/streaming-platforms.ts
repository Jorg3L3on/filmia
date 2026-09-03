import { Platform } from "@/generated/prisma/client";
import { PLATFORM_SERVICE_LABEL, PLATFORMS } from "@/lib/labels";
import {
  parseStoredWatchProviders,
  type WatchProviderOffer,
  type WatchProvidersMxData,
} from "@/lib/watch-providers";

/**
 * Mapa Platform → ids TMDB (watch/providers, región MX) y pistas de nombre.
 *
 * JOR-157 (“Solo en mis plataformas”) usa `titleAvailableOnUserPlatforms` /
 * `applyMinePlatformsFilter`. Solo cuenta **flatrate** (incluido en la
 * suscripción). Rent y buy no califican.
 */
export const STREAMING_PLATFORM_TMDB: Record<
  Platform,
  { providerIds: number[]; nameHints: string[] }
> = {
  NETFLIX: { providerIds: [8], nameHints: ["netflix"] },
  PRIME: { providerIds: [9, 119], nameHints: ["prime video", "amazon prime"] },
  MAX: { providerIds: [1899, 384], nameHints: ["max", "hbo max"] },
  DISNEY: { providerIds: [337], nameHints: ["disney plus", "disney+"] },
  CLARO: { providerIds: [167], nameHints: ["claro video", "claro"] },
  APPLE: { providerIds: [2, 350], nameHints: ["apple tv"] },
  MUBI: { providerIds: [11], nameHints: ["mubi"] },
};

export const parseStoredStreamingPlatforms = (value: unknown): Platform[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const selected = new Set<Platform>();
  for (const item of value) {
    if (typeof item === "string" && PLATFORMS.includes(item as Platform)) {
      selected.add(item as Platform);
    }
  }

  return PLATFORMS.filter((platform) => selected.has(platform));
};

const normalizeProviderName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[+]/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const nameMatchesPlatform = (normalized: string, platform: Platform) => {
  if (platform === "NETFLIX") {
    return normalized.includes("netflix");
  }
  if (platform === "PRIME") {
    return (
      normalized.includes("prime video") ||
      normalized.includes("amazon prime") ||
      normalized === "prime"
    );
  }
  if (platform === "MAX") {
    return normalized === "max" || normalized.includes("hbo max");
  }
  if (platform === "DISNEY") {
    return normalized.includes("disney");
  }
  if (platform === "CLARO") {
    return normalized.includes("claro");
  }
  if (platform === "APPLE") {
    return normalized.includes("apple tv");
  }
  if (platform === "MUBI") {
    return normalized.includes("mubi");
  }
  return false;
};

export const matchWatchProviderPlatform = (
  provider: Pick<WatchProviderOffer, "providerId" | "name">,
): Platform | null => {
  for (const platform of PLATFORMS) {
    if (STREAMING_PLATFORM_TMDB[platform].providerIds.includes(provider.providerId)) {
      return platform;
    }
  }

  const normalized = normalizeProviderName(provider.name);
  if (!normalized) {
    return null;
  }

  for (const platform of PLATFORMS) {
    if (nameMatchesPlatform(normalized, platform)) {
      return platform;
    }
  }

  return null;
};

export const isUserStreamingProvider = (
  provider: Pick<WatchProviderOffer, "providerId" | "name">,
  userPlatforms: readonly Platform[],
) => {
  if (userPlatforms.length === 0) {
    return false;
  }

  const matched = matchWatchProviderPlatform(provider);
  return matched != null && userPlatforms.includes(matched);
};

/**
 * El título está incluido (flatrate) en al menos una plataforma del usuario.
 * Rent/buy no cuentan: el filtro es “disponible en mis suscripciones”.
 */
export const titleAvailableOnUserPlatforms = (
  data: WatchProvidersMxData | null | undefined,
  userPlatforms: readonly Platform[],
) => {
  if (!data || userPlatforms.length === 0) {
    return false;
  }

  return data.flatrate.some((provider) =>
    isUserStreamingProvider(provider, userPlatforms),
  );
};

export type MinePlatformsFilterResult<T> = {
  visible: T[];
  missingCache: number;
};

/**
 * Post-filtro de catálogo (JOR-157).
 *
 * - Pasa si algún provider **flatrate** coincide con las plataformas del usuario.
 * - Sin cache `watchProvidersMx`: se excluye (sin datos de streaming).
 * - Prefs vacías: ningún título pasa (la UI debe mostrar CTA a `/perfil`).
 */
export const applyMinePlatformsFilter = <T extends { watchProvidersMx?: unknown }>(
  titles: readonly T[],
  userPlatforms: readonly Platform[],
): MinePlatformsFilterResult<T> => {
  if (userPlatforms.length === 0) {
    return { visible: [], missingCache: 0 };
  }

  const visible: T[] = [];
  let missingCache = 0;

  for (const title of titles) {
    const data = parseStoredWatchProviders(title.watchProvidersMx);
    if (!data) {
      missingCache += 1;
      continue;
    }

    if (titleAvailableOnUserPlatforms(data, userPlatforms)) {
      visible.push(title);
    }
  }

  return { visible, missingCache };
};

export const resolveMinePlatformsCatalog = <T extends { watchProvidersMx?: unknown }>(
  titles: readonly T[],
  minePlatforms: boolean,
  userPlatforms: readonly Platform[],
) => {
  if (!minePlatforms) {
    return { titles: [...titles], missingCache: 0, needsSetup: false };
  }

  if (userPlatforms.length === 0) {
    return { titles: [] as T[], missingCache: 0, needsSetup: true };
  }

  const { visible, missingCache } = applyMinePlatformsFilter(titles, userPlatforms);
  return { titles: visible, missingCache, needsSetup: false };
};

export const formatUserPlatformsList = (platforms: readonly Platform[]) => {
  const labels = platforms.map((platform) => PLATFORM_SERVICE_LABEL[platform]);
  if (labels.length === 0) {
    return "";
  }
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]} o ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")} o ${labels[labels.length - 1]}`;
};

export const userStreamingProviderIds = (userPlatforms: readonly Platform[]) =>
  [...new Set(userPlatforms.flatMap((platform) => STREAMING_PLATFORM_TMDB[platform].providerIds))];
