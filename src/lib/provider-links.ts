import type { Platform } from "@/db";
import { isAddOnChannel, matchWatchProviderPlatform } from "@/lib/streaming-platforms";
import type { WatchProviderOffer } from "@/lib/watch-providers";

type SearchUrl = (query: string) => string;

/**
 * Where a platform chip goes (FIL-I59): the title's search inside that service, always https.
 * Netflix (/search), Prime Video (/search), HBO Max (play.hbomax.com) and Apple TV list these paths in
 * their apple-app-site-association / app links, so on a phone the tap opens the app; the rest open
 * their own web search. Disney+ declares no search path and its web search 404s logged out, so it
 * opens the service's home (the app on a phone). `null` = no reliable URL: the JustWatch link stays.
 */
export const PLATFORM_SEARCH_URL: Record<Platform, SearchUrl | null> = {
  NETFLIX: (q) => `https://www.netflix.com/search?q=${q}`,
  PRIME: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
  DISNEY: () => "https://www.disneyplus.com/",
  MAX: (q) => `https://play.hbomax.com/search?q=${q}`,
  APPLE: (q) => `https://tv.apple.com/mx/search?term=${q}`,
  PARAMOUNT: (q) => `https://www.paramountplus.com/mx/search/?q=${q}`,
  CRUNCHYROLL: (q) => `https://www.crunchyroll.com/search?q=${q}`,
  VIX: (q) => `https://vix.com/es-es/search?q=${q}`,
  CLARO: (q) => `https://www.clarovideo.com/mexico/search?q=${q}`,
  MUBI: (q) => `https://mubi.com/es/mx/search/films?query=${q}`,
  PLUTO: (q) => `https://pluto.tv/latam/search?query=${q}`,
  AMCPLUS: (q) => `https://www.amcplus.com/search?q=${q}`,
  CURIOSITY: null,
  LIONSGATE: null,
};

/** Rent / buy stores that are not a subscription Platform (TMDB provider ids, MX). */
const STORE_SEARCH_URL: Record<number, SearchUrl> = {
  // Amazon Video (rentar/comprar) lives inside the Prime Video app.
  10: PLATFORM_SEARCH_URL.PRIME!,
  // Google Play Películas.
  3: (q) => `https://play.google.com/store/search?q=${q}&c=movies`,
};

/** «HBO Max Amazon Channel» is watched in Prime Video, «MGM+ Apple TV Channel» in Apple TV. */
const addOnHost = (name: string): Platform | null => {
  if (/\bamazon channel\b/i.test(name)) return "PRIME";
  if (/\bapple tv channel\b/i.test(name)) return "APPLE";
  return null;
};

const searchUrlFor = (provider: Pick<WatchProviderOffer, "providerId" | "name">): SearchUrl | null => {
  const store = STORE_SEARCH_URL[provider.providerId];
  if (store) {
    return store;
  }
  const platform = isAddOnChannel(provider)
    ? addOnHost(provider.name)
    : matchWatchProviderPlatform(provider);
  return platform ? PLATFORM_SEARCH_URL[platform] : null;
};

/** The chip's href: the service's own search for `title`, else `fallback` (JustWatch), else null. */
export const providerWatchHref = (
  provider: Pick<WatchProviderOffer, "providerId" | "name">,
  title: string | null | undefined,
  fallback: string | null = null,
): string | null => {
  const query = title?.trim();
  const build = searchUrlFor(provider);
  if (!query || !build) {
    return fallback;
  }
  return build(encodeURIComponent(query));
};

/** True when the chip goes to the service itself rather than the JustWatch fallback. */
export const providerHasOwnLink = (provider: Pick<WatchProviderOffer, "providerId" | "name">) =>
  searchUrlFor(provider) !== null;
