import Link from "next/link";
import { BackDisc } from "@/components/PageHeader";
import { PosterImage } from "@/components/PosterImage";
import { ShareButton } from "@/components/share/ShareButton";
import { OscarGroupTable } from "@/components/quinielas/OscarGroupTable";
import { OscarLiveRefresh } from "@/components/quinielas/OscarLiveRefresh";
import { cn } from "@/lib/cn";
import type { OscarGroupStanding, OscarGroupSummary } from "@/lib/quinielas/groups";
import type { NightSummary } from "@/lib/quinielas/view";
import { buttonClass } from "@/lib/ui";

const MARK_CLASS = { y: "bg-success", n: "bg-danger", p: "bg-well" } as const;

const Check = ({ hit }: { hit: boolean }) => (
  <span
    aria-hidden="true"
    className={cn("grid size-5 shrink-0 place-items-center rounded-full text-ink", hit ? "bg-success" : "bg-danger")}
  >
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      {hit ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
    </svg>
  </span>
);

/**
 * La noche del Óscar (FIL-I51-4, canvas `Oscar-3-noche`): hits so far, the last categories
 * announced, what is still to come with your vote, and your groups. When every category has a
 * winner it becomes the final result with its image to share.
 */
export const OscarNight = ({
  year,
  night,
  groups,
}: {
  year: number;
  night: NightSummary;
  groups: { group: OscarGroupSummary; standings: OscarGroupStanding[] }[];
}) => {
  const live = night.announced > 0 && !night.finished;
  const dotsLabel =
    night.announced === 0
      ? `${night.total} categorías por anunciar`
      : `${night.announced} categorías anunciadas: ${night.hits} aciertos y ${night.announced - night.hits} fallos; ${night.remaining} por anunciar`;
  return (
    <div className="flex flex-col gap-5" data-quiniela-night={night.finished ? "final" : live ? "live" : "waiting"}>
      {night.finished ? null : <OscarLiveRefresh />}
      <div className="flex items-center gap-3">
        <BackDisc href="/extras" label="Volver a Extras" />
        <div className="min-w-0 flex-1">
          {live ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-danger">
              <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
              En vivo
            </p>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">Quiniela del Óscar {year}</p>
          )}
          <h1 className="mt-1 font-serif text-[1.75rem] font-semibold leading-none text-paper">
            {night.finished ? "Tu resultado" : "La noche del Óscar"}
          </h1>
        </div>
      </div>

      <div className="text-center" aria-live="polite">
        {night.announced === 0 ? (
          <>
            <p className="font-serif text-2xl text-paper">Ya empezó la ceremonia</p>
            <p className="mt-1 text-sm text-fog">Tus aciertos aparecen aquí en cuanto se anuncia cada categoría.</p>
          </>
        ) : night.finished ? (
          <>
            <p className="font-serif text-[4.25rem] leading-none text-paper" data-quiniela-hits>
              {night.hits} <span className="font-serif text-[2.25rem] italic text-fog">de</span> {night.total}
            </p>
            <p className="mt-1 text-fog">{night.hits === 1 ? "acierto" : "aciertos"} · ya se anunció todo</p>
          </>
        ) : (
          <>
            <p className="font-serif text-[4.25rem] leading-none text-paper" data-quiniela-hits>
              {night.hits} <span className="font-serif text-[2.25rem] italic text-fog">de</span> {night.announced}
            </p>
            <p className="mt-1 text-fog">
              {night.hits === 1 ? "acierto" : "aciertos"} · {night.remaining === 1 ? "falta 1 categoría" : `faltan ${night.remaining} categorías`}
            </p>
          </>
        )}
      </div>

      <div className="flex justify-center gap-[3px]" role="img" aria-label={dotsLabel}>
        {night.marks.map((mark, index) => (
          <span key={index} className={cn("h-4 w-2.5 rounded-[3px]", MARK_CLASS[mark])} />
        ))}
      </div>

      {night.latest.length > 0 || night.next ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-chrome bg-surface p-3.5">
          {night.latest.map(({ category, winner, pick, hit }) => (
            <div key={category.id} className="flex items-start gap-2.5 text-sm" data-latest={category.id}>
              <Check hit={hit} />
              <p className="flex-1">
                <b className="text-paper">
                  {category.short}: ganó {winner?.name ?? "—"}.
                </b>{" "}
                <span className="text-fog">{hit ? "Acertaste." : pick ? `Tú dijiste ${pick.name}.` : "No votaste."}</span>
              </p>
            </div>
          ))}
          {night.next ? (
            <div className={cn("flex items-center gap-2.5 text-sm", night.latest.length > 0 && "border-t border-line pt-2.5")}>
              <span className="relative block aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg bg-well ring-2 ring-star">
                {night.next.pick ? (
                  <PosterImage name={night.next.pick.name} posterPath={night.next.pick.posterPath} tmdbSize="w185" sizes="44px" ratio="fill" />
                ) : null}
              </span>
              <p className="flex-1">
                <b className="text-paper">Por anunciar: {night.next.category.label.toLowerCase()}.</b>{" "}
                <span className="text-fog">{night.next.pick ? `Tu voto es ${night.next.pick.name}.` : "No votaste."}</span>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {groups.map(({ group, standings }) => (
        <section key={group.id} aria-label={group.name} className="flex flex-col gap-2 rounded-2xl border border-chrome bg-surface p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <Link href={`/extras/quinielas/grupo/${group.id}`} className="font-serif text-lg text-paper hover:underline">
              {group.name}
            </Link>
            <span className="text-xs text-fog">por invitación</span>
          </div>
          <OscarGroupTable standings={standings} total={night.total} announced={night.announced} />
        </section>
      ))}

      <div className="flex gap-2.5 pb-2">
        <ShareButton
          path="/extras/quinielas"
          imagePath={night.announced > 0 ? "/extras/quinielas/resultado/imagen" : "/extras/quinielas/imagen"}
          fileName={`quiniela-oscar-${year}.png`}
          title={`Mi quiniela del Óscar ${year}`}
          text={
            night.finished
              ? `Acerté ${night.hits} de ${night.total} en la quiniela del Óscar ${year}.`
              : `Voy ${night.hits} de ${night.announced} en la quiniela del Óscar ${year}.`
          }
          className={buttonClass({ size: "lg", className: "flex-1 bg-star hover:bg-star/90" })}
        >
          {night.finished ? "Compartir mi resultado" : "Compartir cómo voy"}
        </ShareButton>
        <Link href="/extras/quinielas/boleta" className={buttonClass({ variant: "ghost", size: "lg", className: "border border-chrome" })}>
          Mi boleta
        </Link>
      </div>
    </div>
  );
};
