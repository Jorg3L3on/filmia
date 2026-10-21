import type { Platform } from "@/db/schema";
import { PLATFORM_LABEL } from "@/lib/labels";
import { getIssuer } from "@/lib/mcp-oauth/config";

/** Output mappers shared by the tools: snake_case, absolute URLs, visible names (FIL-I20-3). */

export const platformShape = (platform: Platform) => ({ id: platform, name: PLATFORM_LABEL[platform] });

export const appUrl = (path: string) => `${getIssuer()}${path}`;

export const posterUrl = (posterPath: string | null | undefined, size = "w342") =>
  posterPath ? `https://image.tmdb.org/t/p/${size}${posterPath}` : null;

export const isoDay = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};
