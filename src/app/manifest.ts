import type { MetadataRoute } from "next";

/** Filmia canvas from globals.css --canvas (JOR-217). */
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
    orientation: "any",
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
