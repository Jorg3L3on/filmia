import { ImageResponse } from "next/og";
import { excerpt } from "@/lib/share-card";
import { getSharedList } from "@/lib/share";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { loadOgMark, OG_COLORS, OgFrame, OgPoster, ogImageSrc } from "@/components/share/og";

export const alt = "Lista en Filmia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const POSTERS = 5;

/** The list card (FIL-I15-4): name, count and the first posters fanned in a row. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const [list, mark] = await Promise.all([getSharedList((await params).token), loadOgMark()]);
  if (!list) {
    return new ImageResponse(<OgFrame mark={mark}>{null}</OgFrame>, size);
  }
  const posters = await Promise.all(
    list.titles
      .filter((title) => title.posterPath)
      .slice(0, POSTERS)
      .map(async (title) => ({ name: title.name, src: await ogImageSrc(tmdbPosterUrl(title.posterPath, "w342")) })),
  );
  const count = list.total === 1 ? "1 título" : `${list.total} títulos`;

  return new ImageResponse(
    (
      <OgFrame mark={mark}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 24, color: OG_COLORS.accent, letterSpacing: 4, textTransform: "uppercase" }}>
            {`Lista · ${count}`}
          </div>
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 700, color: OG_COLORS.paper, marginTop: 8, letterSpacing: -1 }}>
            {excerpt(list.name, 48)}
          </div>
          {posters.length > 0 ? (
            <div style={{ display: "flex", marginTop: 34 }}>
              {posters.map((title, index) => (
                <div key={index} style={{ display: "flex", marginRight: 22 }}>
                  <OgPoster src={title.src} name={title.name} width={180} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </OgFrame>
    ),
    size,
  );
}
