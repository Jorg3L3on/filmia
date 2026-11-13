import { NavLabel } from "@/components/NavOriginTracker";
import { DiariaResult, DiariaUnavailable } from "@/components/juegos/DiariaResult";
import { DiariaShareButton } from "@/components/juegos/DiariaShareButton";
import { Hearts, LineaGame, LineaItem } from "@/components/juegos/LineaGame";
import { Squares } from "@/components/juegos/MayorGame";
import { LINEA_ID, lineaMarks } from "@/lib/juegos/diarias/linea";
import { openLinea } from "@/lib/juegos/diarias/linea-store";
import { loadDiariaTable } from "@/lib/juegos/diarias/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Línea de tiempo · La diaria" } as const;

/**
 * Línea de tiempo (FIL-I54-2, board J-2-linea): eight films to place by year, three lives, the
 * same for every account. Once over, the page is the line as it ended and the day table.
 */
export default async function LineaPage() {
  const userId = await requireUserId();
  const now = new Date();
  const opened = await openLinea(userId, now).catch(() => null);

  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
      <NavLabel label="Línea de tiempo" />
      {opened?.status === "ok" && opened.view.finished ? (
        <DiariaResult
          id={LINEA_ID}
          day={opened.view.day}
          score={`${opened.view.score} de ${opened.view.total}`}
          table={await loadDiariaTable(userId, LINEA_ID, opened.view.day, now)}
          summary={
            <div className="flex items-center justify-between gap-3">
              <Squares answers={opened.view.marks} total={opened.view.total} />
              <Hearts lives={opened.view.lives} max={opened.view.maxLives} />
            </div>
          }
          share={
            <DiariaShareButton
              id={LINEA_ID}
              partidaId={opened.view.partidaId}
              day={opened.view.day}
              score={`${opened.view.score} de ${opened.view.total}`}
              marks={lineaMarks(opened.view)}
            />
          }
        >
          <section aria-label="Tu línea">
            <ol className="relative ml-1 pl-[2.125rem] before:absolute before:bottom-1.5 before:left-3.5 before:top-1.5 before:w-0.5 before:bg-line">
              {opened.view.line.map((item) => (
                <LineaItem key={item.year} item={item} />
              ))}
            </ol>
          </section>
        </DiariaResult>
      ) : opened?.status === "ok" ? (
        <LineaGame key={opened.view.partidaId} initialView={opened.view} />
      ) : (
        <DiariaUnavailable id={LINEA_ID} failed={!opened} />
      )}
    </div>
  );
}
