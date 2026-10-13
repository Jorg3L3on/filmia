import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** A /public file as a data URL: Satori only fetches absolute URLs, never our own origin's paths. */
const publicDataUrl = async (path: string) => {
  const clean = path.replace(/^\/+/, "");
  const type = MIME[clean.split(".").pop()?.toLowerCase() ?? ""];
  if (!type || clean.includes("..")) {
    return null;
  }
  try {
    return `data:${type};base64,${(await readFile(join(process.cwd(), "public", clean))).toString("base64")}`;
  } catch {
    return null;
  }
};

/** The app icon for the card's corner. */
export const loadOgMark = async () => (await publicDataUrl("icon-192.png")) ?? "";

/** TMDB posters stay remote; seeded ones under /posters are inlined. */
export const ogImageSrc = async (src: string | null) =>
  src?.startsWith("/") ? publicDataUrl(src) : src;

/**
 * Pieces of the share OG cards (FIL-I15-4), for next/og (Satori: flexbox and
 * inline styles only). Colours mirror globals.css: canvas, paper, fog, star, accent.
 */
export const OG_COLORS = {
  canvas: "#0e1114",
  paper: "#f0f2f4",
  fog: "#8b939c",
  star: "#f0c14a",
  accent: "#ff7a45",
} as const;

export const OgFrame = ({ children, mark }: { children: ReactNode; mark: string }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: OG_COLORS.canvas,
      backgroundImage: "radial-gradient(circle at 18% 20%, rgba(255,122,69,0.2), rgba(14,17,20,0) 55%)",
      padding: "56px 64px 40px",
      fontFamily: "sans-serif",
    }}
  >
    <div style={{ display: "flex", flex: 1, alignItems: "center" }}>{children}</div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 26, color: OG_COLORS.fog }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>. */}
      <img src={mark} alt="" width={36} height={36} style={{ borderRadius: 9, marginRight: 12 }} />
      Filmia
    </div>
  </div>
);

export const OgPoster = ({ src, name, width }: { src: string | null; name: string; width: number }) => {
  const height = Math.round(width * 1.5);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>.
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      style={{ borderRadius: 18, objectFit: "cover", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
    />
  ) : (
    <div
      style={{
        display: "flex",
        width,
        height,
        borderRadius: 18,
        backgroundColor: "#1c2126",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: OG_COLORS.fog,
        fontSize: 30,
        textAlign: "center",
      }}
    >
      {name}
    </div>
  );
};
