import { ImageResponse } from "next/og";
import { loadOgMark, OG_COLORS } from "@/components/share/og";
import { loadOscarBallot } from "@/lib/quinielas/ballot-load";
import { oscarSeasonYear } from "@/lib/quinielas/ceremonies";
import { getOscarWinners } from "@/lib/quinielas/store";
import { oscarNightSummary } from "@/lib/quinielas/view";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const STORY = { width: 1080, height: 1920 };
const OK = "#5ec48a";
const NO = "#ef6b6b";

/**
 * «Acerté 15 de 23» (FIL-I51-4): the signed-in person's result, or how they are doing mid-night, as
 * a 9:16 PNG for the share sheet. Private and never cached: it changes with every winner.
 */
export async function GET() {
  const userId = await requireUserId();
  const year = oscarSeasonYear();
  const [{ categories, votes }, winners, mark] = await Promise.all([
    loadOscarBallot(userId, year),
    getOscarWinners(year),
    loadOgMark(),
  ]);
  const night = oscarNightSummary(categories, votes, winners);
  const rowSize = categories.length > 20 ? 27 : 31;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: OG_COLORS.canvas,
          backgroundImage: "radial-gradient(circle at 50% 14%, rgba(242,193,78,0.28), rgba(14,17,20,0) 52%)",
          padding: "150px 80px 110px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 36, color: OG_COLORS.paper }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>. */}
          <img src={mark} alt="" width={56} height={56} style={{ borderRadius: 14, marginRight: 18 }} />
          Filmia
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: OG_COLORS.star, textTransform: "uppercase" }}>
            Quiniela del Óscar {year}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", color: OG_COLORS.paper, marginTop: 8 }}>
            <span style={{ fontSize: 60, marginRight: 18 }}>{night.finished ? "Acerté" : "Voy"}</span>
            <span style={{ fontSize: 120, fontWeight: 700 }}>{night.hits}</span>
            <span style={{ fontSize: 60, color: OG_COLORS.fog, margin: "0 18px" }}>de</span>
            <span style={{ fontSize: 120, fontWeight: 700 }}>{night.finished ? night.total : night.announced}</span>
          </div>
          {night.finished ? null : (
            <div style={{ display: "flex", fontSize: 32, color: OG_COLORS.fog }}>faltan {night.remaining} categorías</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36, flex: 1 }}>
          {categories.map((category, index) => {
            const state = night.marks[index];
            const winner = winners[category.id];
            const name = winner ? (category.nominees.find((nominee) => nominee.id === winner.nomineeId)?.name ?? "") : "";
            return (
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
                <div
                  style={{
                    display: "flex",
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    marginRight: 18,
                    backgroundColor: state === "y" ? OK : state === "n" ? NO : "rgba(240,242,244,0.12)",
                  }}
                />
                <div style={{ display: "flex", width: 310, color: OG_COLORS.fog, fontSize: rowSize - 4 }}>{category.short}</div>
                <div style={{ display: "flex", flex: 1, color: state === "p" ? OG_COLORS.fog : OG_COLORS.paper, fontWeight: 600 }}>
                  {state === "p" ? "por anunciar" : name.length > 34 ? `${name.slice(0, 33)}…` : name}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", fontSize: 34, color: OG_COLORS.fog }}>
          ¿Y tú cuántas le atinaste? Juega en Filmia
        </div>
      </div>
    ),
    { ...STORY, headers: { "Cache-Control": "private, no-store" } },
  );
}
