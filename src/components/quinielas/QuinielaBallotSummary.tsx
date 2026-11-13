import Link from "next/link";
import { BackDisc } from "@/components/PageHeader";
import { PosterImage } from "@/components/PosterImage";
import { ShareButton } from "@/components/share/ShareButton";
import { cn } from "@/lib/cn";
import type { CeremonyInfo } from "@/lib/quinielas/hub-core";
import { ballotRows, votedCount, type BallotCategory } from "@/lib/quinielas/view";
import { buttonClass, focusRing } from "@/lib/ui";

type QuinielaBallotSummaryProps = {
  ceremony: CeremonyInfo;
  categories: BallotCategory[];
  votes: Record<string, string>;
  open: boolean;
  /** «domingo 10 de marzo, 5:00 p.m.» */
  closesLabel: string;
};

/**
 * «Tu boleta» (FIL-I51-2, canvas `Oscar-2-boleta-completa`): every category with its pick, a link
 * back to vote while the ballot is open, and the image to share. Closed, it is read-only.
 */
export const QuinielaBallotSummary = ({ ceremony, categories, votes, open, closesLabel }: QuinielaBallotSummaryProps) => {
  const base = `/extras/quinielas/${ceremony.id}`;
  const rows = ballotRows(categories, votes);
  const voted = votedCount(categories, votes);
  return (
    <div className="flex flex-1 flex-col" data-quiniela-summary>
      <div className="flex items-center gap-3">
        <BackDisc href={base} label={open ? "Volver a votar" : `Volver a ${ceremony.night.toLowerCase()}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">{ceremony.title}</p>
          <h1 className="mt-1 font-serif text-[1.9rem] font-semibold leading-none text-paper">Tu boleta</h1>
        </div>
        <span className="shrink-0 rounded-full border border-chrome bg-well px-3 py-1.5 text-[13px] text-paper" data-quiniela-count>
          {voted} de {categories.length}
        </span>
      </div>
      <p className="mt-3 text-sm text-fog">
        {open
          ? `Se cierra al empezar la ceremonia (${closesLabel}). Hasta entonces puedes cambiar cualquier voto.`
          : "La boleta ya cerró: empezó la ceremonia."}
      </p>

      <ol className="mt-4 flex flex-col border-b border-line" aria-label="Tu voto en cada categoría">
        {rows.map(({ category, pick }) => {
          const body = (
            <>
              <span className="relative block aspect-[2/3] w-[26px] shrink-0 overflow-hidden rounded-[5px] bg-well">
                {pick ? (
                  <PosterImage name={pick.name} posterPath={pick.posterPath} tmdbSize="w185" sizes="26px" ratio="fill" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fog">{category.short}</span>
                {pick ? (
                  <b className="truncate font-semibold text-paper">{pick.name}</b>
                ) : (
                  <span className="text-faint">{open ? "Sin voto · toca para votar" : "Sin voto"}</span>
                )}
              </span>
            </>
          );
          return (
            <li key={category.id} className="border-t border-line" data-row={category.id}>
              {open ? (
                <Link
                  href={`${base}?c=${category.id}`}
                  className={cn("flex min-h-[52px] items-center gap-3 py-[7px] hover:bg-well/40", focusRing)}
                  aria-label={`${category.label}: ${pick ? pick.name : "sin voto"}. Cambiar`}
                >
                  {body}
                </Link>
              ) : (
                <div className="flex min-h-[52px] items-center gap-3 py-[7px]">{body}</div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex gap-2.5 pb-2">
        <ShareButton
          path={base}
          imagePath={`${base}/imagen`}
          fileName={`quiniela-${ceremony.id}.png`}
          title={`Mi ${ceremony.title.charAt(0).toLowerCase()}${ceremony.title.slice(1)}`}
          text={`Así va mi ${ceremony.title.charAt(0).toLowerCase()}${ceremony.title.slice(1)}. ¿Y la tuya?`}
          className={buttonClass({ size: "lg", className: "flex-1 gap-2 bg-star hover:bg-star/90" })}
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" />
          </svg>
          Compartir
        </ShareButton>
        <Link href={`${base}/grupos`} className={buttonClass({ variant: "ghost", size: "lg", className: "border border-chrome" })}>
          Retar a alguien
        </Link>
      </div>
    </div>
  );
};
