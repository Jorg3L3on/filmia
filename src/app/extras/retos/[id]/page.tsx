import { notFound } from "next/navigation";
import { after } from "next/server";
import { NavLabel } from "@/components/NavOriginTracker";
import { GustosGame } from "@/components/juegos/GustosGame";
import { MayorGame } from "@/components/juegos/MayorGame";
import { RematchButton } from "@/components/juegos/RematchButton";
import { RetoResultView } from "@/components/juegos/RetosUi";
import { TriviaGame } from "@/components/juegos/TriviaGame";
import { answerRetoMayor } from "@/app/actions/retos";
import { readPartida } from "@/lib/juegos/partidas";
import { DUELOS_PATH, isRetoOpen, parseRetoJuego } from "@/lib/juegos/retos/core";
import { openGustosSide } from "@/lib/juegos/retos/gustos";
import { openMayorRetoSide } from "@/lib/juegos/retos/mayor";
import { notifyRetado } from "@/lib/juegos/retos/push-store";
import { loadRetoResult, loadRival } from "@/lib/juegos/retos/result";
import { expireRetos, readRetoFor, settleRetoPartida, type RetoRow } from "@/lib/juegos/retos/store";
import { openTriviaSide, rivalTriviaAnswers } from "@/lib/juegos/retos/trivia";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reto" } as const;

/** The person's partida in a reto, healing one that ended without settling (a dropped request). */
const mySide = async (userId: string, reto: RetoRow) => {
  const partidaId = reto.fromUserId === userId ? reto.fromPartidaId : reto.toPartidaId;
  const partida = partidaId ? await readPartida(userId, partidaId) : null;
  if (partida?.finishedAt) {
    const unsettled = reto.fromUserId === userId ? reto.sentAt == null && reto.status === "abierto" : reto.status === "abierto";
    if (unsettled) {
      const sent = await settleRetoPartida(partida);
      if (sent?.toUserId) after(() => notifyRetado(sent).catch(() => undefined));
      return { partida, reto: (await readRetoFor(userId, reto.id)) ?? reto };
    }
  }
  return { partida, reto };
};

/**
 * One reto (FIL-I53): the game while the person's side is open, the common result once it is
 * finished, expired or cancelled. Only the two people in it can open it; a reto not yet sent is
 * invisible to its receiver.
 */
export default async function RetoPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const now = new Date();
  await expireRetos(userId, now);
  const found = await readRetoFor(userId, id);
  if (!found) notFound();
  if (found.toUserId === userId && !found.sentAt) notFound();
  const juego = parseRetoJuego(found.juego);
  if (!juego) notFound();
  const { partida, reto } = await mySide(userId, found);

  const playable = !partida?.finishedAt && isRetoOpen(reto, now);
  if (playable) {
    const rival = await loadRival(reto, userId);
    if (juego === "mayor") {
      const view = await openMayorRetoSide(userId, reto, now);
      if (view && !view.finished) {
        const receiving = reto.toUserId === userId && rival?.score != null;
        return (
          <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
            <NavLabel label="Reto" />
            <MayorGame
              key={view.partidaId}
              initialView={view}
              answerAction={answerRetoMayor}
              rival={receiving ? { name: rival!.name, initial: rival!.initial, score: rival!.score! } : null}
              title={receiving ? `${rival!.name} llegó a ${rival!.score}` : `Reto a ${rival?.name ?? "alguien"}`}
              backHref={DUELOS_PATH}
              backLabel="Volver a Duelos"
            />
          </div>
        );
      }
    }
    if (juego === "trivia") {
      const view = await openTriviaSide(userId, reto, now);
      if (view && !view.finished) {
        const rivalPartidaId = reto.fromUserId === userId ? reto.toPartidaId : reto.fromPartidaId;
        return (
          <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
            <NavLabel label="Duelo de trivia" />
            <TriviaGame
              key={view.partidaId}
              initialView={view}
              rival={rival && reto.toUserId === userId ? { name: rival.name, initial: rival.initial } : null}
              rivalAnswers={await rivalTriviaAnswers(rivalPartidaId, view.index)}
            />
          </div>
        );
      }
    }
    if (juego === "gustos") {
      const view = await openGustosSide(userId, reto, now);
      if (view && !view.finished && !view.cancelled && rival) {
        return (
          <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
            <NavLabel label="Duelo de gustos" />
            <GustosGame key={view.partidaId} initialView={view} rival={{ name: rival.name, initial: rival.initial }} />
          </div>
        );
      }
    }
  }

  const result = await loadRetoResult(userId, (await readRetoFor(userId, reto.id)) ?? reto, now);
  if (!result) notFound();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col pb-10">
      <NavLabel label="Reto" />
      <RetoResultView
        result={result}
        now={now}
        rematch={
          result.canRematch && result.other.userId && result.state !== "esperando" ? (
            <RematchButton juego={result.juego} toUserId={result.other.userId} retoId={result.retoId} lens={result.lens} />
          ) : null
        }
      />
    </div>
  );
}
