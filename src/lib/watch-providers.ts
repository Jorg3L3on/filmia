import { TitleKind } from "@/generated/prisma/browser";
import { getTmdbWatchProviders, tmdbProviderLogoUrl } from "@/lib/tmdb";

export type WatchProviderOffer = {
  providerId: number;
  name: string;
  logoPath: string | null;
  logoUrl: string | null;
};

export type WatchProvidersMxData = {
  link: string | null;
  flatrate: WatchProviderOffer[];
  rent: WatchProviderOffer[];
  buy: WatchProviderOffer[];
};

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
};

type TmdbWatchProvidersResponse = {
  results?: Record<
    string,
    {
      link?: string;
      flatrate?: TmdbProvider[];
      rent?: TmdbProvider[];
      buy?: TmdbProvider[];
    }
  >;
};

const MX_REGION = "MX";
export const WATCH_PROVIDERS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeProviders = (providers: TmdbProvider[] | undefined): WatchProviderOffer[] => {
  if (!providers?.length) {
    return [];
  }

  return [...providers]
    .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
    .map((provider) => ({
      providerId: provider.provider_id,
      name: provider.provider_name,
      logoPath: provider.logo_path ?? null,
      logoUrl: tmdbProviderLogoUrl(provider.logo_path),
    }));
};

export const parseMxWatchProviders = (
  response: TmdbWatchProvidersResponse,
): WatchProvidersMxData | null => {
  const mx = response.results?.[MX_REGION];
  if (!mx) {
    return null;
  }

  const flatrate = normalizeProviders(mx.flatrate);
  const rent = normalizeProviders(mx.rent);
  const buy = normalizeProviders(mx.buy);

  if (flatrate.length === 0 && rent.length === 0 && buy.length === 0) {
    return null;
  }

  return {
    link: mx.link ?? null,
    flatrate,
    rent,
    buy,
  };
};

export const hasWatchProvidersData = (data: WatchProvidersMxData | null | undefined) =>
  Boolean(
    data &&
      (data.flatrate.length > 0 || data.rent.length > 0 || data.buy.length > 0),
  );

export const isWatchProvidersCacheFresh = (fetchedAt: Date | null | undefined) => {
  if (!fetchedAt) {
    return false;
  }

  return Date.now() - fetchedAt.getTime() < WATCH_PROVIDERS_CACHE_TTL_MS;
};

export const parseStoredWatchProviders = (
  value: unknown,
): WatchProvidersMxData | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as WatchProvidersMxData;
  if (
    !Array.isArray(data.flatrate) ||
    !Array.isArray(data.rent) ||
    !Array.isArray(data.buy)
  ) {
    return null;
  }

  return data;
};

export const titleNeedsWatchProvidersRefresh = (
  watchProvidersMx: unknown,
  watchProvidersFetchedAt: Date | null | undefined,
) =>
  !parseStoredWatchProviders(watchProvidersMx) &&
  !isWatchProvidersCacheFresh(watchProvidersFetchedAt);

export const fetchMxWatchProviders = async (
  tmdbId: number,
  kind: TitleKind,
): Promise<WatchProvidersMxData | null> => {
  const response = await getTmdbWatchProviders(tmdbId, kind);
  return parseMxWatchProviders(response);
};
