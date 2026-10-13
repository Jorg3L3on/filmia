/**
 * Validates what the browser hands us from `PushSubscription.toJSON()` before it is stored.
 * The server later POSTs to `endpoint`, so only the browsers' own push services are accepted
 * (no arbitrary URLs: that would let anyone point our cron at any host).
 */

export type ParsedPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Chrome/Edge (FCM), Firefox (Mozilla autopush), Safari/iOS (APNs web push), legacy Edge (WNS). */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
];
const PUSH_SERVICE_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

const MAX_ENDPOINT_LENGTH = 1024;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export const isPushServiceEndpoint = (endpoint: string) => {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return (
    PUSH_SERVICE_HOSTS.includes(host) ||
    PUSH_SERVICE_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
};

const parseKey = (value: unknown, min: number, max: number) =>
  typeof value === "string" && value.length >= min && value.length <= max && BASE64URL.test(value)
    ? value
    : null;

export const parsePushSubscription = (input: unknown): ParsedPushSubscription | null => {
  if (!input || typeof input !== "object") {
    return null;
  }
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: unknown };
  if (
    typeof endpoint !== "string" ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    !isPushServiceEndpoint(endpoint)
  ) {
    return null;
  }
  if (!keys || typeof keys !== "object") {
    return null;
  }
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  // p256dh: 65-byte uncompressed P-256 point (87 chars base64url); auth: 16 bytes (22 chars).
  const parsedP256dh = parseKey(p256dh, 80, 100);
  const parsedAuth = parseKey(auth, 16, 32);
  if (!parsedP256dh || !parsedAuth) {
    return null;
  }
  return { endpoint, p256dh: parsedP256dh, auth: parsedAuth };
};
