import Link from "next/link";
import { DotsIcon, EyeIcon, MoonIcon } from "@/components/watchlist/icons";
import type { FichaView } from "@/components/watchlist/types";
import { cn } from "@/lib/cn";
import { focusRing, pillActionClass } from "@/lib/ui";

type WatchlistFichaDetailProps = {
  ficha: FichaView;
  onMarkSeen: () => void;
  onTonight: () => void;
  onMenu: () => void;
  className?: string;
  /** Desktop stage: no clamp. */
  fullSynopsis?: boolean;
};

/** What unfolds under an open ficha (and fills the desktop stage): synopsis, credits, actions. */
export const WatchlistFichaDetail = ({
  ficha,
  onMarkSeen,
  onTonight,
  onMenu,
  className,
  fullSynopsis = false,
}: WatchlistFichaDetailProps) => (
  <div className={cn("flex flex-col gap-3", className)}>
    {ficha.overview ? (
      <p
        className={cn(
          "text-pretty text-[13.5px] leading-relaxed text-[#aab2bb]",
          !fullSynopsis && "line-clamp-4",
        )}
      >
        {ficha.overview}
      </p>
    ) : null}
    {ficha.credits ? <p className="text-xs leading-relaxed text-fog">{ficha.credits}</p> : null}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onMarkSeen}
        className={cn(pillActionClass.primary, "h-11 flex-1 justify-center")}
      >
        <EyeIcon />
        Vi esto
      </button>
      <button
        type="button"
        onClick={onTonight}
        aria-pressed={ficha.pinned}
        className={cn(
          pillActionClass.neutral,
          "h-11 bg-black/30 backdrop-blur-md",
          ficha.pinned && "border-accent/60 text-accent",
        )}
      >
        <MoonIcon />
        {ficha.pinned ? "Para hoy" : "Esta noche"}
      </button>
      <Link
        href={`/titulos/${ficha.id}`}
        className={cn(pillActionClass.neutral, "h-11 bg-black/30 px-4 backdrop-blur-md")}
      >
        Ficha
      </Link>
      <button
        type="button"
        onClick={onMenu}
        aria-label={`Más opciones de ${ficha.name}`}
        className={cn(
          "press-scale inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-chrome bg-black/30 text-fog backdrop-blur-md transition-colors duration-[var(--duration-hover)] hover:text-paper",
          focusRing,
        )}
      >
        <DotsIcon />
      </button>
    </div>
  </div>
);
