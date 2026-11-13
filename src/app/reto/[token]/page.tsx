import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { answerLinkAsMayor } from "@/app/actions/retos";
import { MayorGame, Squares } from "@/components/juegos/MayorGame";
import { RetoAvatar } from "@/components/juegos/RetosUi";
import { cn } from "@/lib/cn";
import { MAYOR_LENSES } from "@/lib/juegos/mayor/core";
import { initialOf, retoOutcome, retoPath } from "@/lib/juegos/retos/core";
import { isLinkSender, linkAsMayorView, loadLinkReto } from "@/lib/juegos/retos/link";
import { getLiveSessionUser } from "@/lib/session";
import { buttonClass, focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** Never indexed; the preview names no one. */
export const metadata: Metadata = {
  title: "Un reto de Mayor o menor · Filmia",
  description: "¿Llegas más lejos? Dos películas: ¿cuál tiene mejor nota?",
  robots: { index: false, follow: false },
};

type LinkPageProps = { params: Promise<{ token: string }> };

/**
 * `/reto/[token]` (FIL-I53-4, outside the session wall): a Mayor o menor reto for someone without
 * an account. They play the sender's sequence until the first miss and see the score against the
 * sender's first name; nothing about them is kept but the answers, tied to the token. An unknown
 * or expired token is a 404; the proxy caps opens per IP (429).
 */
export default async function LinkRetoPage({ params }: LinkPageProps) {
  const { token } = await params;
  const [view, user] = await Promise.all([loadLinkReto(token), getLiveSessionUser()]);
  if (!view) notFound();
  if (user) {
    const retoId = await isLinkSender(token, user.id);
    if (retoId) redirect(retoPath(retoId));
  }
  const lens = MAYOR_LENSES[view.lens];

  if (!view.finished) {
    return (
      <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-3 sm:px-0">
        <MayorGame
          initialView={linkAsMayorView(view)}
          answerAction={answerLinkAsMayor.bind(null, token)}
          rival={{ name: view.fromName, initial: initialOf(view.fromName), score: view.fromScore }}
          title={`${view.fromName} llegó a ${view.fromScore}`}
          backHref={user ? "/" : "/registro"}
          backLabel={user ? "Ir a Filmia" : "Conocer Filmia"}
        />
      </div>
    );
  }

  const outcome = retoOutcome(view.fromScore, view.score);
  const headline = outcome === "to" ? `Le ganaste a ${view.fromName}` : outcome === "empate" ? "Empate: cayeron en el mismo par" : `${view.fromName} te ganó`;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-10 pt-6 sm:px-0" data-reto-enlace="resultado" data-desenlace={outcome}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Mayor o menor · {lens.short} · reto</p>
        <h1 className="font-serif text-[1.8rem] font-semibold leading-tight text-paper">{headline}</h1>
      </div>
      <div className="flex items-start justify-center gap-6" aria-label="Marcador">
        <div className="flex flex-col items-center gap-1.5">
          <RetoAvatar initial="T" me size="lg" />
          <span className={cn("font-serif text-[2.2rem] font-semibold leading-none tabular-nums", outcome === "to" ? "text-success" : "text-paper")}>{view.score}</span>
          <span className="text-sm text-fog">Tú</span>
        </div>
        <span className="mt-9 font-serif text-xl italic text-fog">vs</span>
        <div className="flex flex-col items-center gap-1.5">
          <RetoAvatar initial={initialOf(view.fromName)} seed={view.fromName} size="lg" />
          <span className={cn("font-serif text-[2.2rem] font-semibold leading-none tabular-nums", outcome === "from" ? "text-success" : "text-paper")}>{view.fromScore}</span>
          <span className="text-sm text-fog">{view.fromName}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
        <span className="text-sm text-fog">Tu racha</span>
        <Squares answers={view.answers} small />
      </div>
      {user ? (
        <Link href="/extras/duelos" className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}>
          Ir a Duelos
        </Link>
      ) : (
        <div className="flex flex-col gap-3 rounded-[1.4rem] border border-accent/40 bg-surface p-4" data-reto-enlace="invitacion">
          <h2 className="font-serif text-xl font-semibold text-paper">¿Revancha?</h2>
          <p className="text-sm text-fog">
            Con una cuenta en Filmia puedes retar a {view.fromName} cuando quieras, jugar la diaria y llevar tus películas. No guardamos nada tuyo de este reto, solo el marcador.
          </p>
          <Link href="/registro" className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}>
            Crear mi cuenta
          </Link>
          <Link href="/login" className={cn("self-center text-sm font-semibold text-fog", focusRing)}>
            Ya tengo cuenta
          </Link>
        </div>
      )}
    </div>
  );
}
