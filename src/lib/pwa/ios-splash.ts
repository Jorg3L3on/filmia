import devices from "./ios-splash-devices.json";

/** Bump when the frame-0 artwork changes so a re-install does not reuse a stale HTTP cache. */
export const IOS_SPLASH_VERSION = "2";

/** Single launch color. Manifest, viewport, html, and the PNGs all use this hex. */
export const LAUNCH_COLOR = "#0e1114";

export type IosSplashDevice = {
  name: string;
  /** CSS pixels, portrait. */
  width: number;
  height: number;
  ratio: number;
};

export const IOS_SPLASH_DEVICES = devices as IosSplashDevice[];

export const splashPixelSize = (device: IosSplashDevice) => ({
  width: device.width * device.ratio,
  height: device.height * device.ratio,
});

export const splashFileName = (device: IosSplashDevice) => {
  const { width, height } = splashPixelSize(device);
  return `apple-splash-${width}x${height}.png`;
};

/**
 * iOS shows a startup image only when every clause matches, including orientation.
 * Portrait is the only artwork we ship (see the manifest orientation note).
 */
export const splashMedia = (device: IosSplashDevice) =>
  `(device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.ratio}) and (orientation: portrait)`;

export const splashHref = (device: IosSplashDevice) =>
  `/splash/${splashFileName(device)}?v=${IOS_SPLASH_VERSION}`;

export const IOS_SPLASH_IMAGES = IOS_SPLASH_DEVICES.map((device) => ({
  url: splashHref(device),
  media: splashMedia(device),
}));
