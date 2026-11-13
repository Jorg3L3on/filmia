import Link from "next/link";
import type { ReactNode } from "react";
import { Squares } from "@/components/juegos/MayorGame";
import { cn } from "@/lib/cn";
import { MAYOR_LENSES, type MayorLensId } from "@/lib/juegos/mayor/core";
import { expiresLine, headToHeadScore, RETO_JUEGOS, retoPath } from "@/lib/juegos/retos/core";
import type { RetoResult } from "@/lib/juegos/retos/result";
import type { MyRetoItem, TeTocaItem } from "@/lib/juegos/retos/store";
import { focusRing } from "@/lib/ui";

/**
 * Retos (FIL-I53): the pieces every reto screen shares. Names are first names (or initials) only;
 * avatars are an initial on a colour picked from the name, never a photo or an email.
 */

const TONES = ["bg-accent text-[#1c0c04]", "bg-affinity text-ink", "bg-star text-ink", "bg-success text-ink", "bg-cine text-ink"];

const toneOf = (seed: string) => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length]!;
};

export const RetoAvatar = ({ initial, seed, size = "md", me = false }: { initial: string; seed?: string; size?: "sm" | "md" | "lg"; me?: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex shrink-0 items-center justify-center rounded-full font-semibold",
      size === "sm" && "size-6 text-[11px]",
      size === "md" && "size-10 text-[15px]",
      size === "lg" && "size-14 text-xl",
      me ? "border border-line bg-chrome text-paper" : toneOf(seed ?? initial),
    )}
  >
    {initial}
  </span>
);

export const Eyebrow = ({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "success" | "fog" }) => (
  <p
    className={cn(
      "truncate text-[11px] font-semibold uppercase tracking-[0.16em]",
      tone === "accent" ? "text-accent" : tone === "success" ? "text-success" : "text-fog",
    )}
  >
    {children}
  </p>
);

/** «Te toca» (board Comp-2-portada): retos waiting for the person, oldest first. */
export const TeTocaBlock = ({ items, now }: { items: TeTocaItem[]; now: Date }) => {
  if (items.length === 0) return null;
  const soonest = items.reduce((min, item) => (item.expiresAt < min ? item.expiresAt : min), items[0]!.expiresAt);
  return (
    <section aria-labelledby="te-toca" className="rounded-[1.4rem] border border-accent/40 bg-surface px-3.5 py-3" data-retos="te-toca">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="te-toca" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          Te toca · {items.length === 1 ? "1 reto" : `${items.length} retos`}
        </h2>
        <span className="text-xs text-fog">{expiresLine(soonest, now).replace("Vence", "El primero vence")}</span>
      </div>
      <ul className="mt-1">
        {items.map((item, index) => (
          <li key={item.retoId}>
            <Link
              href={retoPath(item.retoId)}
              className={cn("flex min-h-14 items-center gap-3 py-1.5 text-left", index > 0 && "border-t border-line", focusRing)}
            >
              <RetoAvatar initial={item.initial} seed={item.fromName} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-[15px] font-semibold text-paper">{item.fromName} te retó</b>
                <span className="truncate text-sm text-fog">{item.line}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold",
                  index === 0 ? "bg-accent text-[#1c0c04]" : "border border-line bg-chrome text-paper",
                )}
              >
                {item.started ? "Seguir" : "Jugar"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const STATE_LABEL: Record<MyRetoItem["state"], string> = {
  esperando: "Esperando",
  "te-toca": "Te toca",
  ganaste: "Ganaste",
  perdiste: "Perdiste",
  empate: "Empate",
  jugando: "A medias",
};

/** The person's latest retos (Duelos): who, which game, how it stands. */
export const MyRetosList = ({ items }: { items: MyRetoItem[] }) => (
  <ul className="border-b border-line" data-retos="mios">
    {items.map((item) => (
      <li key={item.retoId}>
        <Link href={retoPath(item.retoId)} className={cn("flex min-h-14 items-center gap-3 border-t border-line py-2 text-left", focusRing)}>
          <RetoAvatar initial={item.initial} seed={item.otherName} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-sm font-semibold text-paper">
              {item.mine === "from" ? `Retaste a ${item.otherName === "Enlace" ? "un enlace" : item.otherName}` : `${item.otherName} te retó`}
            </b>
            <span className="truncate text-xs text-fog">
              {RETO_JUEGOS[item.juego].name} · {item.line}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
              item.state === "ganaste" && "border-success/50 bg-success/15 text-success",
              item.state === "te-toca" && "border-accent/50 bg-accent/15 text-accent",
              !["ganaste", "te-toca"].includes(item.state) && "border-line bg-chrome text-fog",
            )}
          >
            {STATE_LABEL[item.state]}
          </span>
        </Link>
      </li>
    ))}
  </ul>
);

const headlineOf = (result: RetoResult) => {
  const name = result.other.name;
  if (result.state === "cancelado") return "Duelo cancelado";
  if (result.state === "vencido") return "Este reto venció";
  if (result.outcome === "ganaste") return result.other.userId ? `Le ganaste a ${name}` : "Le ganaste a tu enlace";
  if (result.outcome === "perdiste") return result.other.userId ? `${name} te ganó` : "Tu enlace te ganó";
  if (result.outcome === "empate") return result.juego === "mayor" ? `Empate: cayeron en el mismo par` : `Empate con ${name}`;
  return result.other.userId ? `Esperando a ${name}` : "Esperando a quien abra tu enlace";
};

const scoreLabel = (result: RetoResult, score: number | null) =>
  score == null ? "—" : result.juego === "gustos" ? `${score} de 7` : String(score);

/**
 * The common closing screen of a duel (FIL-I53-7, board D-7-resultado): scoreboard, detail, history
 * between the two, and the rematch slot (a client button the page passes in).
 */
export const RetoResultView = ({ result, rematch, share, now }: { result: RetoResult; rematch?: ReactNode; share?: ReactNode; now: Date }) => {
  const juego = RETO_JUEGOS[result.juego];
  const lens = result.juego === "mayor" && MAYOR_LENSES[result.lens as MayorLensId] ? ` · ${MAYOR_LENSES[result.lens as MayorLensId].short}` : "";
  const mineWins = result.outcome === "ganaste";
  const theirsWins = result.outcome === "perdiste";
  return (
    <div className="flex flex-col gap-5" data-retos="resultado" data-estado={result.state} data-desenlace={result.outcome ?? "pendiente"}>
      <div className="flex items-center gap-3">
        <Link
          href="/extras/duelos"
          aria-label="Volver a Duelos"
          className={cn("relative flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-paper", focusRing)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-5">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <Eyebrow tone={result.state === "terminado" ? "success" : "accent"}>
            {juego.name}
            {lens} · {result.state === "terminado" ? "terminado" : result.state === "esperando" ? expiresLine(result.expiresAt, now).toLowerCase() : result.state}
          </Eyebrow>
          <h1 className="truncate font-serif text-[1.6rem] font-semibold leading-tight text-paper">{headlineOf(result)}</h1>
        </div>
      </div>

      <div className="flex items-start justify-center gap-6" aria-label="Marcador">
        <div className="flex flex-col items-center gap-1.5">
          <RetoAvatar initial={result.me.initial} me size="lg" />
          <span className={cn("font-serif text-[2.2rem] font-semibold leading-none tabular-nums", mineWins ? "text-success" : "text-paper")} data-retos="mi-marcador">
            {scoreLabel(result, result.me.score)}
          </span>
          <span className="text-sm text-fog">Tú</span>
        </div>
        <span className="mt-9 font-serif text-xl italic text-fog">vs</span>
        <div className="flex flex-col items-center gap-1.5">
          <RetoAvatar initial={result.other.initial} seed={result.other.name} size="lg" />
          <span className={cn("font-serif text-[2.2rem] font-semibold leading-none tabular-nums", theirsWins ? "text-success" : "text-paper")} data-retos="su-marcador">
            {scoreLabel(result, result.other.score)}
          </span>
          <span className="max-w-24 truncate text-sm text-fog">{result.other.name}</span>
        </div>
      </div>

      {result.detail.length > 0 ? (
        <div className="rounded-[1.2rem] border border-line bg-surface px-4 pb-2 pt-1" data-retos="detalle">
          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-2 py-2 text-xs text-fog">
            <span />
            <span>Pregunta</span>
            <b className="text-right font-semibold">Tú</b>
            <b className="truncate text-right font-semibold">{result.other.name}</b>
          </div>
          {result.detail.map((row, index) => (
            <div key={index} className="grid min-h-10 grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-2 border-t border-line text-sm">
              <span className="text-fog">{index + 1}</span>
              <span className="truncate text-paper">{row.label}</span>
              <b className={cn("text-right tabular-nums", row.mineOk === false ? "font-normal text-fog" : "text-paper")}>{row.mine}</b>
              <b className={cn("text-right tabular-nums", row.theirsOk === false ? "font-normal text-fog" : "text-paper")}>{row.theirs}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-[1.2rem] border border-line bg-surface px-4 py-3" data-retos="detalle">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-fog">Tú</span>
            <Squares answers={result.me.marks} small />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm text-fog">{result.other.name}</span>
            {result.other.score != null ? <Squares answers={result.other.marks} small /> : <span className="text-xs text-fog">Todavía no juega</span>}
          </div>
        </div>
      )}

      {result.h2h ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5" data-retos="historial">
          <span className="flex-1 text-sm text-fog">Entre ustedes dos</span>
          <b className="font-serif text-lg font-semibold text-paper">{result.h2h.played === 0 ? "Primer duelo" : headToHeadScore(result.h2h)}</b>
          {result.h2h.ties > 0 ? <span className="text-xs text-fog">{result.h2h.ties === 1 ? "1 empate" : `${result.h2h.ties} empates`}</span> : null}
        </div>
      ) : null}

      {result.state === "esperando" ? (
        <p className="text-center text-sm text-fog">
          {result.other.userId
            ? `Le avisamos a ${result.other.name}. Tiene 48 horas; si no juega, el reto se borra sin castigo.`
            : "Comparte el enlace: dura 48 horas y se juega sin cuenta."}
        </p>
      ) : null}

      {rematch || share ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {share}
            {rematch}
          </div>
          {rematch ? (
            <p className="text-center text-xs text-fog">
              {result.juego === "trivia"
                ? `La revancha manda cinco preguntas nuevas a ${result.other.name}.`
                : result.juego === "gustos"
                  ? `La revancha arma siete pares nuevos.`
                  : `La revancha es una secuencia nueva: juegas tú primero.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
