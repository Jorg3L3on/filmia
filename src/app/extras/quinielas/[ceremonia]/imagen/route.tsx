import { ImageResponse } from "next/og";
import { loadOgMark, OG_COLORS } from "@/components/share/og";
import { AWARDS } from "@/lib/quinielas/awards";
import { loadBallot } from "@/lib/quinielas/ballot-load";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { ceremonyInfo } from "@/lib/quinielas/hub-core";
import { ballotRows, votedCount } from "@/lib/quinielas/view";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const STORY = { width: 1080, height: 1920 };

/**
 * «Compartir» de la boleta de una entrega (FIL-I51-2): the signed-in person's own ballot as a 9:16 PNG for the
 * share sheet, like the compatibility story. 150 px clear at the top and 110 px at the bottom for
 * Instagram's UI. Private: it is only ever fetched by its owner, never cached by the CDN.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ ceremonia: string }> }) {
  const userId = await requireUserId();
  const file = getCeremony((await params).ceremonia);
  if (!file) {
    return new Response("No encontrado", { status: 404 });
  }
  const ceremony = ceremonyInfo(file);
  const accent = AWARDS[file.award].accent;
  const [{ categories, votes }, mark] = await Promise.all([loadBallot(userId, file.id), loadOgMark()]);
  const rows = ballotRows(categories, votes);
  const voted = votedCount(categories, votes);
  const rowSize = rows.length > 20 ? 27 : 31;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: OG_COLORS.canvas,
          backgroundImage: `radial-gradient(circle at 50% 12%, ${accent}42, rgba(14,17,20,0) 52%)`,
          padding: "150px 80px 110px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 36, color: OG_COLORS.paper }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>. */}
          <img src={mark} alt="" width={56} height={56} style={{ borderRadius: 14, marginRight: 18 }} />
          Filmia
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: accent, textTransform: "uppercase" }}>
            {ceremony.title}
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: OG_COLORS.paper, marginTop: 8 }}>Mi boleta</div>
          <div style={{ display: "flex", fontSize: 32, color: OG_COLORS.fog, marginTop: 6 }}>
            {voted} de {rows.length} categorías
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, flex: 1 }}>
          {rows.map(({ category, pick }) => (
            <div
              key={category.id}
              style={{
                display: "flex",
                alignItems: "center",
                borderTop: "1px solid rgba(240,242,244,0.12)",
                padding: "9px 0",
                fontSize: rowSize,
              }}
            >
              <div style={{ display: "flex", width: 330, color: OG_COLORS.fog, fontSize: rowSize - 4 }}>{category.short}</div>
              <div style={{ display: "flex", flex: 1, color: pick ? OG_COLORS.paper : OG_COLORS.fog, fontWeight: 600 }}>
                {pick ? (pick.name.length > 38 ? `${pick.name.slice(0, 37)}…` : pick.name) : "—"}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", fontSize: 34, color: OG_COLORS.fog }}>
          ¿Y tú quién crees que gana? Juega en Filmia
        </div>
      </div>
    ),
    { ...STORY, headers: { "Cache-Control": "private, no-store" } },
  );
}
