import type { Platform } from "@/db";

/**
 * Aura bloom (ported from MiCasa's row tint): two soft radial washes, strong
 * in the top-left corner and faint in the bottom-right. Colors are "r g b".
 */
export const auraBloomImage = (rgb: string, strength = 1) =>
  `radial-gradient(85% 120% at 0% 0%, rgb(${rgb} / ${round(0.2 * strength)}), transparent 60%), ` +
  `radial-gradient(70% 100% at 100% 100%, rgb(${rgb} / ${round(0.08 * strength)}), transparent 65%)`;

const round = (value: number) => Math.round(value * 1000) / 1000;

export const hexToRgbChannels = (hex: string) => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  const value = Number.parseInt(full, 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

/** Filmia accent as channels — fallback glow for titles without a platform. */
export const ACCENT_RGB = "124 156 255";

/**
 * Glow hue per platform. Uses the brand's vivid color; near-black brands use
 * their accent text color instead so the bloom still reads.
 */
const PLATFORM_GLOW_HEX: Record<Platform, string | null> = {
  NETFLIX: "#e50914",
  PRIME: "#00a8e1",
  DISNEY: "#113ccf",
  MAX: "#002be7",
  APPLE: null,
  PARAMOUNT: "#0064ff",
  CRUNCHYROLL: "#f47521",
  VIX: "#ffe600",
  CLARO: "#da291c",
  MUBI: null,
  PLUTO: "#ffd200",
  AMCPLUS: null,
  CURIOSITY: "#ff6b00",
  LIONSGATE: "#d4a017",
};

export const platformGlowRgb = (platform: Platform | null | undefined) => {
  const hex = platform ? PLATFORM_GLOW_HEX[platform] : null;
  return hex ? hexToRgbChannels(hex) : ACCENT_RGB;
};
