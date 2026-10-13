import webpush, { WebPushError } from "web-push";

/**
 * Web Push (VAPID). Without the three env vars push is simply off: Perfil hides the
 * «Avisos» switch and the cron sends nothing. Generate the pair with
 * `npx web-push generate-vapid-keys`.
 */
export const vapidPublicKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;

const vapidPrivateKey = () => process.env.VAPID_PRIVATE_KEY?.trim() || null;

/**
 * `mailto:` or public `https:` contact for the push services; falls back to an https
 * AUTH_URL. Apple rejects localhost subjects (BadJwtToken), so those don't count.
 */
const vapidSubject = () => {
  for (const candidate of [process.env.VAPID_SUBJECT, process.env.AUTH_URL]) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "mailto:" || (url.protocol === "https:" && url.hostname !== "localhost")) {
        return value;
      }
    } catch {
      // Not a URL: try the next one.
    }
  }
  return null;
};

export const isPushConfigured = () => Boolean(vapidPublicKey() && vapidPrivateKey() && vapidSubject());

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** What `sw.js` reads from the push event. */
export type PushPayload = {
  title: string;
  body: string;
  /** Same-origin path the notification opens. */
  url: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag?: string;
  icon?: string;
};

/** `gone`: the browser dropped the subscription (404/410) — delete the row. */
export type PushSendOutcome = "sent" | "gone" | "failed";

const TTL_SECONDS = 24 * 60 * 60;

export const sendPush = async (
  subscription: StoredPushSubscription,
  payload: PushPayload,
): Promise<PushSendOutcome> => {
  const publicKey = vapidPublicKey();
  const privateKey = vapidPrivateKey();
  const subject = vapidSubject();
  if (!publicKey || !privateKey || !subject) {
    return "failed";
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      {
        TTL: TTL_SECONDS,
        urgency: "normal",
        vapidDetails: { subject, publicKey, privateKey },
      },
    );
    return "sent";
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      return "gone";
    }
    return "failed";
  }
};
