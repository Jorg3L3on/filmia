import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARRIVAL_WINDOW_MS,
  MAX_ARRIVAL_PUSHES_PER_USER,
  arrivalPayload,
  arrivalPayloadsForUser,
  arrivalPlatform,
  selectArrivals,
  type ArrivalCandidate,
} from "./platform-arrivals";
import { detectPushSupport, urlBase64ToUint8Array, type PushEnvironment } from "./push-support";
import { isPushServiceEndpoint, parsePushSubscription } from "./push-subscription";

const NOW = new Date("2026-10-13T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const offer = (providerId: number, name: string) => ({ providerId, name, logoPath: null, logoUrl: null });
const providers = (...flatrate: ReturnType<typeof offer>[]) => ({ link: null, flatrate, rent: [], buy: [] });

const candidate = (overrides: Partial<ArrivalCandidate> = {}): ArrivalCandidate => ({
  userId: "u1",
  titleId: "t1",
  catalogId: "c1",
  name: "Dune: Parte dos",
  availableSince: ago(DAY),
  addedAt: ago(30 * DAY),
  watchProvidersMx: providers(offer(8, "Netflix")),
  streamingPlatforms: ["NETFLIX"],
  ...overrides,
});

describe("arrivalPlatform", () => {
  it("picks the first flatrate offer on the user's platforms", () => {
    const data = providers(offer(337, "Disney Plus"), offer(119, "Amazon Prime Video"));
    assert.equal(arrivalPlatform(data, ["PRIME", "DISNEY"]), "DISNEY");
    assert.equal(arrivalPlatform(data, ["PRIME"]), "PRIME");
  });

  it("is null off the user's platforms, without platforms or without data", () => {
    assert.equal(arrivalPlatform(providers(offer(8, "Netflix")), ["MAX"]), null);
    assert.equal(arrivalPlatform(providers(offer(8, "Netflix")), []), null);
    assert.equal(arrivalPlatform(null, ["NETFLIX"]), null);
  });

  it("ignores rent and buy offers", () => {
    const data = { link: null, flatrate: [], rent: [offer(8, "Netflix")], buy: [offer(8, "Netflix")] };
    assert.equal(arrivalPlatform(data, ["NETFLIX"]), null);
  });
});

describe("selectArrivals", () => {
  it("announces a Quiero ver title that just reached one of the user's platforms", () => {
    const [arrival, ...rest] = selectArrivals([candidate()], NOW);
    assert.equal(rest.length, 0);
    assert.deepEqual(arrival, {
      userId: "u1",
      titleId: "t1",
      catalogId: "c1",
      name: "Dune: Parte dos",
      platform: "NETFLIX",
      availableSince: ago(DAY),
    });
  });

  it("skips arrivals outside the window or stamped in the future", () => {
    assert.equal(selectArrivals([candidate({ availableSince: ago(ARRIVAL_WINDOW_MS + 1) })], NOW).length, 0);
    assert.equal(selectArrivals([candidate({ availableSince: new Date(NOW.getTime() + 1) })], NOW).length, 0);
    assert.equal(selectArrivals([candidate({ availableSince: ago(ARRIVAL_WINDOW_MS) })], NOW).length, 1);
  });

  it("skips titles added to Quiero ver after they arrived (the user already knew)", () => {
    assert.equal(selectArrivals([candidate({ addedAt: ago(DAY / 2) })], NOW).length, 0);
    assert.equal(selectArrivals([candidate({ addedAt: ago(DAY) })], NOW).length, 0);
  });

  it("skips arrivals on a platform the user doesn't have", () => {
    assert.equal(selectArrivals([candidate({ streamingPlatforms: ["MAX"] })], NOW).length, 0);
    assert.equal(selectArrivals([candidate({ streamingPlatforms: [] })], NOW).length, 0);
    assert.equal(selectArrivals([candidate({ streamingPlatforms: "junk" })], NOW).length, 0);
  });

  it("never yields the same film twice for one user in a run", () => {
    const arrivals = selectArrivals(
      [candidate(), candidate({ titleId: "t1-dup" }), candidate({ userId: "u2", titleId: "t2" })],
      NOW,
    );
    assert.deepEqual(
      arrivals.map((arrival) => `${arrival.userId}:${arrival.catalogId}`),
      ["u1:c1", "u2:c1"],
    );
  });
});

describe("arrival payloads", () => {
  const arrival = selectArrivals([candidate()], NOW)[0]!;

  it("names the title and the platform and opens the ficha", () => {
    assert.deepEqual(arrivalPayload(arrival), {
      title: "Llegó a Netflix",
      body: "«Dune: Parte dos», de tu Quiero ver, ya está en Netflix.",
      url: "/titulos/t1",
      tag: "llego-c1",
    });
  });

  it("sends one push per title up to the cap, then one summary", () => {
    const many = Array.from({ length: MAX_ARRIVAL_PUSHES_PER_USER + 2 }, (_, index) => ({
      ...arrival,
      titleId: `t${index}`,
      catalogId: `c${index}`,
      name: `Película ${index}`,
    }));
    assert.equal(arrivalPayloadsForUser(many.slice(0, MAX_ARRIVAL_PUSHES_PER_USER)).length, MAX_ARRIVAL_PUSHES_PER_USER);

    const [summary, ...rest] = arrivalPayloadsForUser(many);
    assert.equal(rest.length, 0);
    assert.equal(summary!.title, `${many.length} de Quiero ver llegaron a tus plataformas`);
    assert.equal(summary!.body, "«Película 0», «Película 1» y 3 más ya se pueden ver.");
    assert.equal(summary!.url, "/watchlist?minePlatforms=1");
  });
});

describe("parsePushSubscription", () => {
  const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

  it("accepts the browsers' push services", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGx",
      "https://wns2-bn3p.notify.windows.com/w/?token=x",
    ]) {
      assert.deepEqual(parsePushSubscription({ endpoint, keys }), { endpoint, ...keys });
    }
  });

  it("rejects arbitrary hosts, http, ports and credentials", () => {
    for (const endpoint of [
      "https://evil.example.com/push",
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/fcm/send/abc",
      "https://user:pw@fcm.googleapis.com/x",
      "https://push.apple.com.evil.com/x",
      "not a url",
    ]) {
      assert.equal(isPushServiceEndpoint(endpoint), false, endpoint);
      assert.equal(parsePushSubscription({ endpoint, keys }), null, endpoint);
    }
  });

  it("rejects missing or malformed keys", () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    assert.equal(parsePushSubscription({ endpoint }), null);
    assert.equal(parsePushSubscription({ endpoint, keys: { p256dh: "short", auth: keys.auth } }), null);
    assert.equal(parsePushSubscription({ endpoint, keys: { p256dh: keys.p256dh, auth: "bad auth!!" } }), null);
    assert.equal(parsePushSubscription(null), null);
    assert.equal(parsePushSubscription("x"), null);
  });
});

describe("detectPushSupport", () => {
  const env = (overrides: Partial<PushEnvironment>): PushEnvironment => ({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130",
    maxTouchPoints: 0,
    standalone: false,
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    ...overrides,
  });
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1";

  it("asks iPhone and iPad Safari to install the PWA first", () => {
    assert.equal(detectPushSupport(env({ userAgent: iphone, hasPushManager: false, hasNotification: false })), "ios-needs-install");
    assert.equal(detectPushSupport(env({ userAgent: "Mozilla/5.0 (Macintosh) Safari", maxTouchPoints: 5 })), "ios-needs-install");
  });

  it("supports the installed iPhone PWA and desktop browsers with the APIs", () => {
    assert.equal(detectPushSupport(env({ userAgent: iphone, standalone: true })), "supported");
    assert.equal(detectPushSupport(env({})), "supported");
  });

  it("is unsupported without the push APIs", () => {
    assert.equal(detectPushSupport(env({ hasPushManager: false })), "unsupported");
    assert.equal(detectPushSupport(env({ userAgent: iphone, standalone: true, hasNotification: false })), "unsupported");
  });

  it("decodes a base64url VAPID key", () => {
    assert.deepEqual([...urlBase64ToUint8Array("AQID_-8")], [1, 2, 3, 255, 239]);
  });
});
