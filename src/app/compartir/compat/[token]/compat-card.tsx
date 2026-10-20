import { excerpt } from "@/lib/share-card";
import { compatLabel } from "@/lib/compat";
import type { SharedCompat } from "@/lib/compat-store";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { OG_COLORS, OgPoster, ogImageSrc } from "@/components/share/og";

/** Affinity lilac (globals.css `--affinity`): the % is always in it. */
export const OG_AFFINITY = "#c9b2ff";

export const loadCompatPosters = (shared: SharedCompat, size: "w342" | "w500") =>
  Promise.all(
    shared.card.bothLove.slice(0, 3).map(async (film) => ({
      name: film.name,
      src: await ogImageSrc(tmdbPosterUrl(film.posterPath, size)),
    })),
  );

/**
 * The card both images draw (Satori: flexbox and inline styles): side by side
 * on the 1200×630 OG, stacked and bigger on the 9:16 `story`.
 */
export const CompatCardBody = ({
  shared,
  posters,
  story = false,
}: {
  shared: SharedCompat;
  posters: { name: string; src: string | null }[];
  story?: boolean;
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: story ? "column" : "row",
      alignItems: "center",
      width: "100%",
      justifyContent: "space-between",
    }}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: story ? "center" : "flex-start",
        textAlign: story ? "center" : "left",
        maxWidth: story ? 900 : 560,
      }}
    >
      <div style={{ fontSize: story ? 40 : 26, color: OG_AFFINITY, letterSpacing: 4, textTransform: "uppercase" }}>
        {`${shared.names[0]} × ${shared.names[1]}`}
      </div>
      <div style={{ fontSize: story ? 260 : 150, lineHeight: 1, fontWeight: 700, color: OG_COLORS.paper, marginTop: 12 }}>
        {compatLabel(shared.card)}
      </div>
      <div style={{ fontSize: story ? 56 : 36, color: OG_COLORS.paper, fontWeight: 600, marginTop: 4 }}>compatibles</div>
      <div style={{ fontSize: story ? 40 : 26, color: OG_COLORS.fog, marginTop: 18 }}>{excerpt(shared.card.phrase, 80)}</div>
    </div>
    {posters.length > 0 ? (
      <div style={{ display: "flex", marginTop: story ? 90 : 0 }}>
        {posters.map((poster, index) => (
          <div key={index} style={{ display: "flex", marginLeft: index === 0 ? 0 : story ? 28 : 16 }}>
            <OgPoster src={poster.src} name={poster.name} width={story ? 280 : 150} />
          </div>
        ))}
      </div>
    ) : null}
  </div>
);
