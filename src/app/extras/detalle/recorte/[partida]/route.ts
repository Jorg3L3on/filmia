import sharp from "sharp";
import { detalleCrop } from "@/lib/juegos/diarias/detalle";
import { readCropSource } from "@/lib/juegos/diarias/detalle-store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Output side of the square crop, in pixels (shown at 250 px; 2× for retina). */
const SIZE = 500;

/**
 * Detalle's crop (FIL-I54-1): the person's current poster cut at a level they already reached, as
 * a JPEG. The poster is fetched here from TMDB's image CDN (not the API: no quota) and never sent
 * whole; a level not reached yet, another poster or someone else's partida is a 404.
 */
export async function GET(request: Request, { params }: { params: Promise<{ partida: string }> }) {
  const userId = await requireUserId();
  const url = new URL(request.url);
  const index = Number(url.searchParams.get("p"));
  const level = Number(url.searchParams.get("n"));
  if (!Number.isInteger(index) || !Number.isInteger(level)) return new Response("No encontrado", { status: 404 });
  const source = await readCropSource(userId, (await params).partida, index, level);
  if (!source) return new Response("No encontrado", { status: 404 });

  const poster = await fetch(`https://image.tmdb.org/t/p/w500${source.posterPath}`, { next: { revalidate: 86_400 } }).catch(() => null);
  if (!poster?.ok) return new Response("Sin póster", { status: 502 });
  const image = sharp(Buffer.from(await poster.arrayBuffer()));
  const { width = 0, height = 0 } = await image.metadata();
  if (!width || !height) return new Response("Sin póster", { status: 502 });
  const crop = detalleCrop({ x: source.x, y: source.y, level, width, height });
  const body = await image.extract(crop).resize(SIZE, SIZE, { kernel: "lanczos3" }).jpeg({ quality: 82 }).toBuffer();
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
  });
}
