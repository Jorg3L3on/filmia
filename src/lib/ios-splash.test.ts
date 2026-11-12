import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";
import { isProxyStaticAsset } from "./proxy-static";
import {
  IOS_SPLASH_DEVICES,
  IOS_SPLASH_IMAGES,
  LAUNCH_COLOR,
  splashFileName,
  splashHref,
  splashMedia,
  splashPixelSize,
} from "./pwa/ios-splash";

const root = path.resolve(import.meta.dirname, "../..");

describe("iOS splash artwork", () => {
  it("ships one portrait PNG per device, in the launch color", async () => {
    assert.ok(IOS_SPLASH_DEVICES.length >= 19);
    const seen = new Set<string>();

    for (const device of IOS_SPLASH_DEVICES) {
      assert.ok(device.width < device.height, `${device.name} must be portrait`);
      const key = `${device.width}x${device.height}@${device.ratio}`;
      assert.equal(seen.has(key), false, `duplicate ${key}`);
      seen.add(key);

      const media = splashMedia(device);
      assert.match(media, new RegExp(`device-width: ${device.width}px`));
      assert.match(media, new RegExp(`device-height: ${device.height}px`));
      assert.match(media, new RegExp(`-webkit-device-pixel-ratio: ${device.ratio}\\)`));
      assert.match(media, /orientation: portrait/);
      assert.equal(splashHref(device).startsWith(`/splash/${splashFileName(device)}?v=`), true);

      const { width, height } = splashPixelSize(device);
      const file = path.join(root, "public/splash", splashFileName(device));
      const meta = await sharp(file).metadata();
      assert.equal(meta.width, width, device.name);
      assert.equal(meta.height, height, device.name);

      const corner = await sharp(file)
        .extract({ left: 0, top: 0, width: 1, height: 1 })
        .removeAlpha()
        .raw()
        .toBuffer();
      const [red, green, blue] = corner;
      assert.ok(red !== undefined && green !== undefined && blue !== undefined);
      assert.ok(Math.abs(red - 0x0e) <= 24, `${device.name} corner r ${red}`);
      assert.ok(Math.abs(green - 0x11) <= 24, `${device.name} corner g ${green}`);
      assert.ok(Math.abs(blue - 0x14) <= 24, `${device.name} corner b ${blue}`);
    }

    assert.equal(IOS_SPLASH_IMAGES.length, IOS_SPLASH_DEVICES.length);
    assert.equal(LAUNCH_COLOR, "#0e1114");
  });
});

describe("launch wiring", () => {
  const read = (file: string) => readFileSync(path.join(root, file), "utf8");

  it("keeps one launch color and the Apple startup meta", () => {
    const manifest = read("src/app/manifest.ts");
    const layout = read("src/app/layout.tsx");
    assert.match(manifest, /background_color: CANVAS/);
    assert.match(manifest, /theme_color: CANVAS/);
    assert.match(manifest, /orientation: "portrait"/);
    assert.doesNotMatch(manifest, /#090b0d/);
    assert.match(layout, /themeColor: THEME_COLOR/);
    assert.match(layout, /startupImage: IOS_SPLASH_IMAGES/);
    assert.match(layout, /"apple-mobile-web-app-capable": "yes"/);
    const css = read("src/app/globals.css");
    // FIL-43: the mark at rest, shown only standalone, with the 4s safety and a 170ms reduced fade.
    assert.match(css, /\.launch-mark \{[^}]*width: 72px/);
    assert.match(css, /\.launch-glow \{[^}]*top: 43%/);
    assert.match(css, /display-mode: standalone/);
    assert.match(css, /launch-safety 240ms ease 4s forwards/);
    assert.match(css, /launch-mark-out 640ms var\(--ease-out\)/);
    assert.match(css, /launch-poster-in 1\.1s var\(--ease-out\)/);
    assert.match(css, /scale: 0\.34;\s+filter: blur\(10px\)/);
    assert.match(css, /translate: 0 16px/);
    assert.match(css, /launch-fade 170ms linear both !important/);
    // The Iris is gone: no hold, no iris-* rules or keyframes.
    assert.doesNotMatch(css, /iris-/);
    assert.match(layout, /axes: \["opsz"\]/);
    const loading = read("src/app/loading.tsx");
    assert.doesNotMatch(loading, /Iris|ViewTransition/);
    // FIL-I25-6: Hoy's skeleton only on `/`; the root boundary is neutral elsewhere.
    assert.match(loading, /RootLoadingSkeleton/);
    // FIL-I46-2: a ficha keeps its own skeleton (with the tapped poster), the rest stays neutral.
    const rootSkeleton = read("src/components/RootLoadingSkeleton.tsx");
    assert.match(rootSkeleton, /pathname === "\/"\) \{\n\s+return <HoySkeleton \/>/);
    assert.match(rootSkeleton, /return <PageChromeSkeleton \/>/);
    assert.match(rootSkeleton, /FichaBodySkeleton poster=/);
    // FIL-43: the loader sits in the root layout, outside Suspense, and leaves after its exit.
    assert.match(layout, /<LaunchLoader \/>/);
    const loader = read("src/components/launch/LaunchLoader.tsx");
    assert.match(loader, /display-mode: standalone/);
    assert.match(loader, /dataset\.state = "out"/);
    assert.match(loader, /launch-glow-out/);
    assert.doesNotMatch(read("src/components/launch/LaunchMark.tsx"), /useState|useEffect|Filmia<|Preparando/);
  });

  it("skips the session lookup for the worker and splash files", () => {
    assert.equal(isProxyStaticAsset("/sw.js"), true);
    assert.equal(isProxyStaticAsset("/app.webmanifest"), true);
    assert.equal(isProxyStaticAsset("/splash/apple-splash-1179x2556.png"), true);
    assert.equal(isProxyStaticAsset("/icon-192.png"), true);
    assert.equal(isProxyStaticAsset("/"), false);
    assert.equal(isProxyStaticAsset("/login"), false);
    assert.equal(isProxyStaticAsset("/api/auth/login"), false);
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /isProxyStaticAsset/);
    assert.match(proxy, /sw\\\\\.js/);
    assert.match(read("public/sw.js"), /navigationPreload\.enable/);
  });
});
