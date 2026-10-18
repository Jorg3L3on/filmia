import type { MetadataRoute } from "next";

/**
 * Launch color. Same hex as globals.css --canvas, the viewport themeColor,
 * and the iOS startup PNGs. One color, so iOS never paints a different plate
 * while the splash image is loading.
 */
const CANVAS = "#0e1114";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Filmia",
    short_name: "Filmia",
    description: "Diario personal de películas y series.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: CANVAS,
    theme_color: CANVAS,
    lang: "es",
    // Portrait only. Startup images match a single orientation; `any` would
    // launch a landscape iPhone onto the flat background color. The UI is a
    // phone diary (bottom nav, coverflow), so the standalone app stays portrait
    // and each device needs one PNG.
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
