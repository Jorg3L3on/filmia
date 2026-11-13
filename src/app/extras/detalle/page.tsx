import { NavLabel } from "@/components/NavOriginTracker";
import { DetalleGame } from "@/components/juegos/DetalleGame";
import { DiariaResult, DiariaUnavailable } from "@/components/juegos/DiariaResult";
import { DiariaShareButton } from "@/components/juegos/DiariaShareButton";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { DETALLE_ID, detalleMarks } from "@/lib/juegos/diarias/detalle";
import { openDetalle } from "@/lib/juegos/diarias/detalle-store";
import { loadDiariaTable } from "@/lib/juegos/diarias/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Detalle · La diaria" } as const;

/**
 * Detalle (FIL-I54-1, board D-2-detalle): three posters a day, each from a crop that opens in six
 * steps, the same for every account. Once over, the page is the result and the day table.
 */
export default async function DetallePage() {
  const userId = await requireUserId();
  const now = new Date();
  const opened = await openDetalle(userId, now).catch(() => null);

  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
      <NavLabel label="Detalle" />
      {opened?.status === "ok" && opened.view.finished ? (
        <DiariaResult
          id={DETALLE_ID}
          day={opened.view.day}
          score={`${opened.view.score} de ${opened.view.total}`}
          table={await loadDiariaTable(userId, DETALLE_ID, opened.view.day, now)}
          summary={
            <ul className="grid grid-cols-3 gap-3" data-detalle="resumen">
              {opened.view.posters.map((poster) => (
                <li key={poster.index} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                  <span className="block w-full overflow-hidden rounded-xl">
                    <PosterImage name={poster.reveal?.name ?? ""} posterPath={poster.reveal?.posterPath ?? null} sizes="100px" tmdbSize="w185" />
                  </span>
                  <span className="line-clamp-2 text-xs font-semibold leading-tight text-paper">{poster.reveal?.name ?? "Película"}</span>
                  <span className={cn("text-xs font-semibold", poster.status === "solved" ? "text-success" : "text-danger")}>
                    {poster.status === "solved" ? `Recorte ${poster.level} · +${poster.points}` : "No salió"}
                  </span>
                </li>
              ))}
            </ul>
          }
          share={
            <DiariaShareButton
              id={DETALLE_ID}
              partidaId={opened.view.partidaId}
              day={opened.view.day}
              score={`${opened.view.score} de ${opened.view.total}`}
              marks={detalleMarks(opened.view)}
            />
          }
        />
      ) : opened?.status === "ok" ? (
        <DetalleGame key={opened.view.partidaId} initialView={opened.view} />
      ) : (
        <DiariaUnavailable id={DETALLE_ID} failed={!opened} />
      )}
    </div>
  );
}
