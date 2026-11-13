import { ImageResponse } from "next/og";
import { loadOgMark, OG_COLORS } from "@/components/share/og";
import { DIARIAS, diariaNumber } from "@/lib/juegos/diarias/core";
import { readShareableDiaria, type ShareTone } from "@/lib/juegos/diarias/share";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const STORY = { width: 1080, height: 1920 };
const TONES: Record<ShareTone, string> = { ok: "#3dd68c", mid: "#f2c14e", no: "#ff6b7a", none: "#2a3138" };

/**
 * «Compartir resultado» of a FIL-I54 daily (Detalle, Línea de tiempo, Reparto misterioso, La
 * cuadrícula): the person's own finished daily as a 9:16 PNG, the same look as Mayor o menor's.
 * Score and squares only, never a film. Anything else is a 404. Never cached by the CDN.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ partida: string }> }) {
  const userId = await requireUserId();
  const result = await readShareableDiaria(userId, (await params).partida);
  if (!result) {
    return new Response("No encontrado", { status: 404 });
  }
  const mark = await loadOgMark();
  const widest = Math.max(...result.rows.map((row) => row.length));
  const size = Math.min(150, Math.floor((900 - 28 * (widest - 1)) / widest));

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
          <div style={{ display: "flex", fontSize: 32, letterSpacing: 4, color: OG_COLORS.accent, textTransform: "uppercase" }}>La diaria</div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 700, color: OG_COLORS.paper, marginTop: 10 }}>{DIARIAS[result.id].name}</div>
          <div style={{ display: "flex", fontSize: 40, color: OG_COLORS.fog, marginTop: 8 }}>n.º {diariaNumber(result.id, result.day)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 110 }}>
          <div style={{ display: "flex", fontSize: 220, fontWeight: 700, color: OG_COLORS.star, lineHeight: 1 }}>{result.score}</div>
          <div style={{ display: "flex", fontSize: 72, color: OG_COLORS.fog, marginLeft: 24 }}>de {result.total}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 80 }}>
          {result.rows.map((row, rowIndex) => (
            <div key={rowIndex} style={{ display: "flex", marginTop: rowIndex === 0 ? 0 : 28 }}>
              {row.map((tone, index) => (
                <div key={index} style={{ display: "flex", width: size, height: size, borderRadius: Math.round(size / 5), marginRight: 28, backgroundColor: TONES[tone] }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "center", fontSize: 36, color: OG_COLORS.fog }}>¿Y tú? Juega la diaria en Filmia</div>
      </div>
    ),
    { ...STORY, headers: { "Cache-Control": "private, no-store" } },
  );
}
