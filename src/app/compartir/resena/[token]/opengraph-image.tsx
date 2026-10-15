import { ImageResponse } from "next/og";
import { formatStarScore, TITLE_KIND_LABEL } from "@/lib/labels";
import { excerpt, STAR_PATH, starFills } from "@/lib/share-card";
import { getSharedReview } from "@/lib/share";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { loadOgMark, OG_COLORS, OgFrame, OgPoster, ogImageSrc } from "@/components/share/og";

export const alt = "Reseña en Filmia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** The review card (FIL-I15-4): what a chat or a social network shows for the link, and what Compartir sends. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const [review, mark] = await Promise.all([getSharedReview((await params).token), loadOgMark()]);
  if (!review) {
    return new ImageResponse(<OgFrame mark={mark}>{null}</OgFrame>, size);
  }
  const meta = [review.year, TITLE_KIND_LABEL[review.kind]].filter(Boolean).join(" · ");
  const quote = excerpt(review.review, 210);
  const fills = starFills(review.rating);
  const poster = await ogImageSrc(tmdbPosterUrl(review.posterPath, "w500"));

  return new ImageResponse(
    (
      <OgFrame mark={mark}>
        <OgPoster src={poster} name={review.name} width={310} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 56, justifyContent: "center" }}>
          {meta ? <div style={{ fontSize: 26, color: OG_COLORS.fog }}>{meta}</div> : null}
          <div
            style={{
              fontSize: review.name.length > 28 ? 54 : 68,
              lineHeight: 1.05,
              color: OG_COLORS.paper,
              fontWeight: 700,
              marginTop: 8,
              letterSpacing: -1,
            }}
          >
            {excerpt(review.name, 60)}
          </div>
          {fills.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
              {fills.map((fill, index) => (
                <div key={index} style={{ display: "flex", position: "relative", width: 46, height: 46, marginRight: 6 }}>
                  <svg viewBox="0 0 24 24" width={46} height={46} style={{ position: "absolute", top: 0, left: 0 }}>
                    <path d={STAR_PATH} fill={OG_COLORS.star} opacity={0.22} />
                  </svg>
                  {fill > 0 ? (
                    <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: 46 * fill, height: 46, overflow: "hidden" }}>
                      <svg viewBox="0 0 24 24" width={46} height={46}>
                        <path d={STAR_PATH} fill={OG_COLORS.star} />
                      </svg>
                    </div>
                  ) : null}
                </div>
              ))}
              <div style={{ fontSize: 34, fontWeight: 700, color: OG_COLORS.star, marginLeft: 10 }}>
                {formatStarScore(review.rating)}
              </div>
            </div>
          ) : null}
          {quote ? (
            <div style={{ fontSize: 30, lineHeight: 1.35, color: OG_COLORS.paper, opacity: 0.88, marginTop: 28 }}>
              {`«${quote}»`}
            </div>
          ) : null}
        </div>
      </OgFrame>
    ),
    size,
  );
}
