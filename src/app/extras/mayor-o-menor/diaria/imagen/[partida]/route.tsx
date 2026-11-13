import { ImageResponse } from "next/og";
import { loadOgMark, OG_COLORS } from "@/components/share/og";
import { dailyNumber, MAYOR_LENSES } from "@/lib/juegos/mayor/core";
import { readShareableDaily } from "@/lib/juegos/mayor/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const STORY = { width: 1080, height: 1920 };
const OK = "#3dd68c";
const NO = "#ff6b7a";

/**
 * «Compartir resultado» of the daily (FIL-I52-4): the person's own finished daily as a 9:16 PNG
 * for the share sheet. Squares and the score only, never a film or a value. Someone else's
 * partida, an unfinished one or a free streak is a 404. Never cached by the CDN.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ partida: string }> }) {
  const userId = await requireUserId();
  const result = await readShareableDaily(userId, (await params).partida);
  if (!result) {
    return new Response("No encontrado", { status: 404 });
  }
  const mark = await loadOgMark();
  const rows = [result.answers.slice(0, 5), result.answers.slice(5, 10)];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: OG_COLORS.canvas,
          backgroundImage: `radial-gradient(circle at 50% 18%, ${OG_COLORS.accent}38, rgba(14,17,20,0) 55%)`,
          padding: "150px 90px 110px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 36, color: OG_COLORS.paper }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>. */}
          <img src={mark} alt="" width={56} height={56} style={{ borderRadius: 14, marginRight: 18 }} />
          Filmia
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 120 }}>
          <div style={{ display: "flex", fontSize: 32, letterSpacing: 4, color: OG_COLORS.accent, textTransform: "uppercase" }}>
            La diaria · {MAYOR_LENSES[result.lens].short}
          </div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 700, color: OG_COLORS.paper, marginTop: 10 }}>Mayor o menor</div>
          <div style={{ display: "flex", fontSize: 40, color: OG_COLORS.fog, marginTop: 8 }}>n.º {dailyNumber(result.day)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 110 }}>
          <div style={{ display: "flex", fontSize: 220, fontWeight: 700, color: OG_COLORS.star, lineHeight: 1 }}>{result.score}</div>
          <div style={{ display: "flex", fontSize: 72, color: OG_COLORS.fog, marginLeft: 24 }}>de {result.total}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 80 }}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} style={{ display: "flex", marginTop: rowIndex === 0 ? 0 : 28 }}>
              {row.map((ok, index) => (
                <div
                  key={index}
                  style={{ display: "flex", width: 150, height: 150, borderRadius: 30, marginRight: 28, backgroundColor: ok ? OK : NO }}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "center", fontSize: 36, color: OG_COLORS.fog }}>¿Y tú cuántas le atinas? Juega en Filmia</div>
      </div>
    ),
    { ...STORY, headers: { "Cache-Control": "private, no-store" } },
  );
}
