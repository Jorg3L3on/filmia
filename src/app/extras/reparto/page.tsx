import { NavLabel } from "@/components/NavOriginTracker";
import { DiariaResult, DiariaUnavailable } from "@/components/juegos/DiariaResult";
import { DiariaShareButton } from "@/components/juegos/DiariaShareButton";
import { Squares } from "@/components/juegos/MayorGame";
import { RepartoCast, RepartoGame } from "@/components/juegos/RepartoGame";
import { PosterImage } from "@/components/PosterImage";
import { REPARTO_ID, repartoMarks } from "@/lib/juegos/diarias/reparto";
import { openReparto } from "@/lib/juegos/diarias/reparto-store";
import { loadDiariaTable } from "@/lib/juegos/diarias/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reparto misterioso · La diaria" } as const;

/**
 * Reparto misterioso (FIL-I54-3, board J-3-reparto): one film a day from its cast, the least known
 * first, six tries, the same for every account. Once over, the answer and the day table.
 */
export default async function RepartoPage() {
  const userId = await requireUserId();
  const now = new Date();
  const opened = await openReparto(userId, now).catch(() => null);

  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
      <NavLabel label="Reparto misterioso" />
      {opened?.status === "ok" && opened.view.finished ? (
        <DiariaResult
          id={REPARTO_ID}
          day={opened.view.day}
          score={`${opened.view.score} de ${opened.view.total}`}
          table={await loadDiariaTable(userId, REPARTO_ID, opened.view.day, now)}
          summary={
            <div className="flex items-center gap-3.5" data-reparto="respuesta">
              <span className="block w-16 shrink-0 overflow-hidden rounded-lg">
                <PosterImage name={opened.view.answer?.name ?? ""} posterPath={opened.view.answer?.posterPath ?? null} sizes="64px" tmdbSize="w185" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <b className="line-clamp-2 font-serif text-[1.2rem] font-semibold leading-tight text-paper">
                  {opened.view.answer?.name ?? "Película"}
                  {opened.view.answer?.year ? <span className="ml-1.5 text-sm font-normal text-fog">{opened.view.answer.year}</span> : null}
                </b>
                <span className="text-sm text-fog">
                  {opened.view.solved ? `La sacaste en el intento ${opened.view.tries}.` : "No salió esta vez."}
                </span>
                <Squares answers={opened.view.marks} total={opened.view.maxTries} small />
              </div>
            </div>
          }
          share={
            <DiariaShareButton
              id={REPARTO_ID}
              partidaId={opened.view.partidaId}
              day={opened.view.day}
              score={`${opened.view.score} de ${opened.view.total}`}
              marks={repartoMarks(opened.view)}
            />
          }
        >
          <RepartoCast view={opened.view} />
        </DiariaResult>
      ) : opened?.status === "ok" ? (
        <RepartoGame key={opened.view.partidaId} initialView={opened.view} />
      ) : (
        <DiariaUnavailable id={REPARTO_ID} failed={!opened} />
      )}
    </div>
  );
}
