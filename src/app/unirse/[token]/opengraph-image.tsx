import { ImageResponse } from "next/og";
import { excerpt } from "@/lib/share-card";
import { getInvitePreview } from "@/lib/list-invites";
import { personFirstName } from "@/lib/person-avatar";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { loadOgMark, OG_COLORS, OgFrame, OgPoster, ogImageSrc } from "@/components/share/og";

export const alt = "Invitación a una lista en Filmia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/**
 * WhatsApp's preview of an invite (canvas 1·4): whose list, its name, how many
 * films and the first posters. A dead link gets the bare frame.
 */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const [preview, mark] = await Promise.all([getInvitePreview((await params).token), loadOgMark()]);
  if (!preview) {
    return new ImageResponse(<OgFrame mark={mark}>{null}</OgFrame>, size);
  }
  const { list } = preview;
  const posters = await Promise.all(
    list.posters
      .filter((poster) => poster.posterPath)
      .map(async (poster) => ({ name: poster.name, src: await ogImageSrc(tmdbPosterUrl(poster.posterPath, "w342")) })),
  );
  const count = list.total === 1 ? "1 película" : `${list.total} películas`;

  return new ImageResponse(
    (
      <OgFrame mark={mark}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 24, color: OG_COLORS.accent, letterSpacing: 4, textTransform: "uppercase" }}>
            {`Lista de ${personFirstName(list.ownerName)} · ${count}`}
          </div>
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 700, color: OG_COLORS.paper, marginTop: 8, letterSpacing: -1 }}>
            {excerpt(list.name, 48)}
          </div>
          {posters.length > 0 ? (
            <div style={{ display: "flex", marginTop: 34 }}>
              {posters.map((poster, index) => (
                <div key={index} style={{ display: "flex", marginRight: 22 }}>
                  <OgPoster src={poster.src} name={poster.name} width={180} />
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
