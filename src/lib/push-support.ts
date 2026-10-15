/**
 * Can this browser get «Llegó a tu plataforma»? iPhone/iPad Safari only exposes Web Push
 * to a PWA opened from the home screen (iOS 16.4+), so there we explain how to install
 * instead of showing a switch that can't work.
 */
export type PushSupport = "supported" | "ios-needs-install" | "unsupported";

export type PushEnvironment = {
  userAgent: string;
  /** `navigator.maxTouchPoints`: iPadOS reports itself as a Mac. */
  maxTouchPoints: number;
  /** `display-mode: standalone` or `navigator.standalone`. */
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
};

export const isAppleMobile = (userAgent: string, maxTouchPoints: number) =>
  /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);

export const detectPushSupport = (env: PushEnvironment): PushSupport => {
  const apis = env.hasServiceWorker && env.hasPushManager && env.hasNotification;
  if (isAppleMobile(env.userAgent, env.maxTouchPoints) && !env.standalone) {
    return "ios-needs-install";
  }
  return apis ? "supported" : "unsupported";
};

/** VAPID public key (base64url) → the bytes `pushManager.subscribe` wants. */
export const urlBase64ToUint8Array = (base64Url: string) => {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
};
