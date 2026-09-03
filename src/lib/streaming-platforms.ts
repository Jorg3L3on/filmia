import { Platform } from "@/generated/prisma/client";
import { PLATFORMS } from "@/lib/labels";
import type { WatchProviderOffer, WatchProvidersMxData } from "@/lib/watch-providers";

/**
 * Mapa Platform → ids TMDB (watch/providers, región MX) y pistas de nombre.
 * JOR-157 puede filtrar `watchProvidersMx.flatrate` con estos ids o con
 * `titleAvailableOnUserPlatforms`.
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

/** JOR-157: el título está en flatrate de al menos una plataforma del usuario. */
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

export const userStreamingProviderIds = (userPlatforms: readonly Platform[]) =>
  [...new Set(userPlatforms.flatMap((platform) => STREAMING_PLATFORM_TMDB[platform].providerIds))];
