import Link from "next/link";
import { notFound } from "next/navigation";
import { NavLabel } from "@/components/NavOriginTracker";
import { MayorTopBar, Squares } from "@/components/juegos/MayorGame";
import { RetoPicker } from "@/components/juegos/RetoPicker";
import { cn } from "@/lib/cn";
import { MAYOR_LENSES, parseMayorLens } from "@/lib/juegos/mayor/core";
import { DUELOS_PATH, parseRetoJuego, RETO_JUEGOS } from "@/lib/juegos/retos/core";
import { gustosEligible, gustosReadiness } from "@/lib/juegos/retos/gustos";
import { readSendableMayor } from "@/lib/juegos/retos/mayor";
import { listRetables } from "@/lib/juegos/retos/store";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Retar a alguien" } as const;

type RetarSearchParams = Record<string, string | string[] | undefined>;

/**
 * «Retar a alguien» (FIL-I53-1, board Comp-3-reto): pick the person among those one already shares a
 * list, a quiniela group or a duel with (never every account). With a
 * finished free streak of Mayor o menor the reto goes out as it is; a duel opens for the sender
 * to play first.
 */
export default async function RetarPage({ searchParams }: { searchParams: Promise<RetarSearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const juego = parseRetoJuego(params.juego);
  if (!juego) notFound();
  const partidaParam = typeof params.partida === "string" ? params.partida : null;
  const sendable = juego === "mayor" && partidaParam ? await readSendableMayor(userId, partidaParam) : null;
  if (partidaParam && !sendable) notFound();
  const lens = sendable?.lens ?? parseMayorLens(params.lente) ?? "imdb";

  if (juego === "gustos") {
    const readiness = await gustosReadiness(userId);
    if (!readiness.notas || readiness.missing) {
      return (
        <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col gap-5">
          <NavLabel label="Retar a alguien" />
          <MayorTopBar eyebrow={RETO_JUEGOS.gustos.name} title="Retar a alguien" backHref={DUELOS_PATH} backLabel="Volver a Duelos" />
          <div className="rounded-2xl border border-line bg-surface px-4 py-4 text-[15px] leading-snug text-fog" data-retos="gustos-falta">
            {!readiness.notas ? (
              <>
                <p>
                  Este duelo usa tus notas: quien juegue contigo verá, de dos en dos y después de contestar, qué calificación le pusiste a cada película.
                </p>
                <Link href="/perfil#tu-filmia" className={cn("mt-3 inline-block font-semibold text-accent", focusRing)}>
                  Encender «Usar mis notas en juegos»
                </Link>
              </>
            ) : (
              <p>{readiness.missing} Hacen falta 14 películas con nota tuya para armar siete pares.</p>
            )}
          </div>
        </div>
      );
    }
  }

  const people = await listRetables(userId, new Date(), juego === "gustos" ? gustosEligible : undefined);

  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col gap-5">
      <NavLabel label="Retar a alguien" />
      <MayorTopBar
        eyebrow={juego === "mayor" ? `Mayor o menor · ${MAYOR_LENSES[lens].short}` : RETO_JUEGOS[juego].name}
        title="Retar a alguien"
        backHref={DUELOS_PATH}
        backLabel="Volver a Duelos"
      />
      {sendable ? (
        <div className="flex items-center gap-3.5 rounded-[1.4rem] border border-line bg-surface p-4" data-retos="racha">
          <span className="font-serif text-[2.5rem] font-semibold leading-none text-star tabular-nums">{sendable.score}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <b className="text-[15px] font-semibold text-paper">Tu racha a vencer</b>
            <Squares answers={sendable.answers} small />
            <span className="text-xs text-fog">Va a jugar los mismos pares que tú, en el mismo orden.</span>
          </div>
        </div>
      ) : (
        <p className="text-[15px] leading-snug text-fog">
          {juego === "mayor"
            ? "Juegas una racha nueva y, cuando falles, le llega a quien elijas: los mismos pares, en el mismo orden."
            : juego === "trivia"
              ? "Contestas cinco preguntas y le llegan las mismas a quien elijas."
              : "Adivinas cuál de siete pares le gustó más a esa persona; después le toca adivinar los tuyos."}
        </p>
      )}
      <RetoPicker juego={juego} people={people} partidaId={sendable?.partida.id ?? null} lens={lens} />
    </div>
  );
}
