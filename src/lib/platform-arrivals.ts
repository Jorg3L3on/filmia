import type { Platform } from "@/db";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import type { PushPayload } from "@/lib/push/web-push";
import { matchWatchProviderPlatform, parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { parseStoredWatchProviders } from "@/lib/watch-providers";

/**
 * «Llegó a tu plataforma» (FIL-I12): a Quiero ver title whose catalog row got a fresh
 * `availableSince` stamp (a flatrate MX offer appeared after a look without one) and is
 * now on one of the user's platforms. The cron runs daily, so a few days of window covers
 * missed runs without digging up old news; the `PlatformAlert` ledger stops repeats.
 */
export const ARRIVAL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Past this many arrivals in one run a user gets one summary instead of a pile of pushes. */
export const MAX_ARRIVAL_PUSHES_PER_USER = 3;

/** One Quiero ver entry of a subscribed user whose film has an `availableSince` stamp. */
export type ArrivalCandidate = {
  userId: string;
  titleId: string;
  catalogId: string;
  name: string;
  availableSince: Date;
  /** When it went into Quiero ver. */
  addedAt: Date;
  watchProvidersMx: unknown;
  /** `User.streamingPlatforms` as stored. */
  streamingPlatforms: unknown;
};

export type PlatformArrival = {
  userId: string;
  titleId: string;
  catalogId: string;
  name: string;
  platform: Platform;
  availableSince: Date;
};

/** First flatrate offer (TMDB display order) on one of the user's platforms. */
export const arrivalPlatform = (
  watchProvidersMx: unknown,
  userPlatforms: readonly Platform[],
): Platform | null => {
  const data = parseStoredWatchProviders(watchProvidersMx);
  if (!data || userPlatforms.length === 0) {
    return null;
  }
  for (const provider of data.flatrate) {
    const platform = matchWatchProviderPlatform(provider);
    if (platform && userPlatforms.includes(platform)) {
      return platform;
    }
  }
  return null;
};

/**
 * Keeps the arrivals worth a push: stamped inside the window (and not in the future), added
 * to Quiero ver before it arrived (otherwise the user already knew), and on their platforms.
 */
export const selectArrivals = (
  candidates: readonly ArrivalCandidate[],
  now: Date,
  windowMs = ARRIVAL_WINDOW_MS,
): PlatformArrival[] => {
  const since = now.getTime() - windowMs;
  const arrivals: PlatformArrival[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const stamp = candidate.availableSince.getTime();
    if (stamp < since || stamp > now.getTime()) continue;
    if (candidate.addedAt.getTime() >= stamp) continue;

    const platform = arrivalPlatform(
      candidate.watchProvidersMx,
      parseStoredStreamingPlatforms(candidate.streamingPlatforms),
    );
    if (!platform) continue;

    const key = `${candidate.userId}:${candidate.catalogId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    arrivals.push({
      userId: candidate.userId,
      titleId: candidate.titleId,
      catalogId: candidate.catalogId,
      name: candidate.name,
      platform,
      availableSince: candidate.availableSince,
    });
  }

  return arrivals;
};

export const arrivalPayload = (arrival: PlatformArrival): PushPayload => {
  const service = PLATFORM_SERVICE_LABEL[arrival.platform];
  return {
    title: `Llegó a ${service}`,
    body: `«${arrival.name}», de tu Quiero ver, ya está en ${service}.`,
    url: `/titulos/${arrival.titleId}`,
    tag: `llego-${arrival.catalogId}`,
  };
};

/** One user's pushes for a run: one per title, or a single summary past the cap. */
export const arrivalPayloadsForUser = (arrivals: readonly PlatformArrival[]): PushPayload[] => {
  if (arrivals.length <= MAX_ARRIVAL_PUSHES_PER_USER) {
    return arrivals.map(arrivalPayload);
  }
  const names = arrivals.slice(0, 2).map((arrival) => `«${arrival.name}»`);
  return [
    {
      title: `${arrivals.length} de Quiero ver llegaron a tus plataformas`,
      body: `${names.join(", ")} y ${arrivals.length - names.length} más ya se pueden ver.`,
      url: "/watchlist?minePlatforms=1",
      tag: "llego-resumen",
    },
  ];
};
