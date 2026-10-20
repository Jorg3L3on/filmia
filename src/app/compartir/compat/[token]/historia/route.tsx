import { ImageResponse } from "next/og";
import { getSharedCompat } from "@/lib/compat-store";
import { loadOgMark, OG_COLORS } from "@/components/share/og";
import { CompatCardBody, loadCompatPosters } from "../compat-card";

export const dynamic = "force-dynamic";

const STORY = { width: 1080, height: 1920 };
/** A day at the CDN: the % moves only when someone rates. */
const CACHE = "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400";

/**
 * «Compartir en historias» (FIL-I19-4, canvas 2·3): the 9:16 PNG the share sheet
 * attaches. 150 px clear at the top and 110 px at the bottom for Instagram's UI.
 * Never «donde no coinciden» nor anyone's rating.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const shared = await getSharedCompat((await params).token);
  if (!shared) {
    return new Response("No encontrado", { status: 404 });
  }
  const [mark, posters] = await Promise.all([loadOgMark(), loadCompatPosters(shared, "w500")]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: OG_COLORS.canvas,
          backgroundImage:
            "radial-gradient(circle at 50% 18%, rgba(201,178,255,0.28), rgba(14,17,20,0) 55%), radial-gradient(circle at 50% 90%, rgba(255,122,69,0.22), rgba(14,17,20,0) 50%)",
          padding: "150px 72px 110px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, color: OG_COLORS.paper }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>. */}
          <img src={mark} alt="" width={64} height={64} style={{ borderRadius: 16, marginRight: 20 }} />
          Filmia
        </div>
        <CompatCardBody shared={shared} posters={posters} story />
        <div style={{ display: "flex", fontSize: 36, color: OG_COLORS.fog }}>¿Y tú? Descúbrelo en Filmia</div>
      </div>
    ),
    { ...STORY, headers: { "Cache-Control": CACHE } },
  );
}
