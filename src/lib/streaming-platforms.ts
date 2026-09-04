import { Platform } from "@/generated/prisma/client";
import { PLATFORM_SERVICE_LABEL, PLATFORMS } from "@/lib/labels";
import { tmdbProviderLogoUrl } from "@/lib/tmdb";
import {
  parseStoredWatchProviders,
  type WatchProviderOffer,
  type WatchProvidersMxData,
} from "@/lib/watch-providers";

type StreamingPlatformTmdb = {
  providerIds: number[];
  nameHints: string[];
  logoPath: string;
};

/**
 * Mapa Platform → ids TMDB (watch/providers, región MX), logos JustWatch y pistas de nombre.
 *
 * JOR-157 (“Solo en mis plataformas”) usa `titleAvailableOnUserPlatforms` /
 * `applyMinePlatformsFilter`. Solo cuenta **flatrate** (incluido en la
 * suscripción). Rent y buy no califican.
 *
 * `logoPath` es el logo oficial de JustWatch vía TMDB (`/watch/providers`).
 */
export const STREAMING_PLATFORM_TMDB: Record<Platform, StreamingPlatformTmdb> = {
  NETFLIX: {
    providerIds: [8],
    nameHints: ["netflix"],
    logoPath: "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",
  },
  PRIME: {
    providerIds: [9, 119],
    nameHints: ["prime video", "amazon prime"],
    logoPath: "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",
  },
  DISNEY: {
    providerIds: [337],
    nameHints: ["disney plus", "disney+"],
    logoPath: "/97yvRBw1GzX7fXprcF80er19ot.jpg",
  },
  MAX: {
    providerIds: [1899, 384],
    nameHints: ["max", "hbo max"],
    logoPath: "/fksCUZ9QDWZMUwL2LgMtLckROUN.jpg",
  },
  APPLE: {
    providerIds: [350, 2],
    nameHints: ["apple tv"],
    logoPath: "/2E03IAZsX4ZaUqM7tXlctEPMGWS.jpg",
  },
  PARAMOUNT: {
    providerIds: [531],
    nameHints: ["paramount plus", "paramount+"],
    logoPath: "/h5DcR0J2EESLitnhR8xLG1QymTE.jpg",
  },
  CRUNCHYROLL: {
    providerIds: [283],
    nameHints: ["crunchyroll"],
    logoPath: "/mXeC4TrcgdU6ltE9bCBCEORwSQR.jpg",
  },
  VIX: {
    providerIds: [457],
    nameHints: ["vix"],
    logoPath: "/jwRPknT20dfU1GeVqbcDXFyvtdG.jpg",
  },
  CLARO: {
    providerIds: [167],
    nameHints: ["claro video", "claro"],
    logoPath: "/21M5CpiOYGOhHj2sVPXqwt6yeTO.jpg",
  },
  MUBI: {
    providerIds: [11],
    nameHints: ["mubi"],
    logoPath: "/fj9Y8iIMFUC6952HwxbGixTQPb7.jpg",
  },
  PLUTO: {
    providerIds: [300],
    nameHints: ["pluto tv", "pluto"],
    logoPath: "/dB8G41Q6tSL5NBisrIeqByfepBc.jpg",
  },
  AMCPLUS: {
    providerIds: [526],
    nameHints: ["amc plus", "amc+"],
    logoPath: "/ovmu6uot1XVvsemM2dDySXLiX57.jpg",
  },
  CURIOSITY: {
    providerIds: [190],
    nameHints: ["curiosity"],
    logoPath: "/oR1aNm1Qu9jQBkW4VrGPWhqbC3P.jpg",
  },
  LIONSGATE: {
    providerIds: [561],
    nameHints: ["lionsgate"],
    logoPath: "/e2hCUg2Z3sJ6yWF9NLU24SIKeWa.jpg",
  },
};

export const streamingPlatformLogoUrl = (platform: Platform) =>
  tmdbProviderLogoUrl(STREAMING_PLATFORM_TMDB[platform].logoPath, "w92");

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

const PLATFORM_NAME_MATCH: Record<Platform, (normalized: string) => boolean> = {
  NETFLIX: (normalized) => normalized.includes("netflix"),
  PRIME: (normalized) =>
    normalized.includes("prime video") ||
    normalized.includes("amazon prime") ||
    normalized === "prime",
  DISNEY: (normalized) => normalized.includes("disney"),
  MAX: (normalized) => normalized === "max" || normalized.includes("hbo max"),
  APPLE: (normalized) => normalized.includes("apple tv"),
  PARAMOUNT: (normalized) => normalized.includes("paramount"),
  CRUNCHYROLL: (normalized) => normalized.includes("crunchyroll"),
  VIX: (normalized) =>
    normalized === "vix" ||
    normalized.startsWith("vix ") ||
    normalized.includes(" vix"),
  CLARO: (normalized) => normalized.includes("claro"),
  MUBI: (normalized) => normalized.includes("mubi"),
  PLUTO: (normalized) =>
    normalized === "pluto" || normalized.includes("pluto tv"),
  AMCPLUS: (normalized) =>
    normalized.includes("amc plus") || normalized === "amc+",
  CURIOSITY: (normalized) => normalized.includes("curiosity"),
  LIONSGATE: (normalized) => normalized.includes("lionsgate"),
};

const nameMatchesPlatform = (normalized: string, platform: Platform) =>
  PLATFORM_NAME_MATCH[platform](normalized);

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
