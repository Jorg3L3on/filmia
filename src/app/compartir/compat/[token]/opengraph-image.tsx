import { ImageResponse } from "next/og";
import { getSharedCompat } from "@/lib/compat-store";
import { loadOgMark, OgFrame } from "@/components/share/og";
import { CompatCardBody, loadCompatPosters } from "./compat-card";

export const alt = "Compatibilidad en Filmia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** The link preview (FIL-I19-4): names, %, phrase and the films both loved. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const [shared, mark] = await Promise.all([getSharedCompat((await params).token), loadOgMark()]);
  if (!shared) {
    return new ImageResponse(<OgFrame mark={mark}>{null}</OgFrame>, size);
  }
  const posters = await loadCompatPosters(shared, "w342");
  return new ImageResponse(
    (
      <OgFrame mark={mark}>
        <CompatCardBody shared={shared} posters={posters} />
      </OgFrame>
    ),
    size,
  );
}
