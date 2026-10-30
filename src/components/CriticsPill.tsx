import { ImdbBadge } from "@/components/ImdbBadge";
import { cn } from "@/lib/cn";
import {
  metacriticSearchUrl,
  metacriticTier,
  rottenTomatoesSearchUrl,
  rtIsFresh,
  type MetacriticTier,
} from "@/lib/critic-scores";
import { focusRing } from "@/lib/ui";

type CriticsPillProps = {
  /** Title name, for the Rotten Tomatoes / Metacritic search links (OMDb sends no ids). */
  name: string;
  imdbRating?: number | null;
  imdbHref?: string | null;
  rtScore?: number | null;
  metascore?: number | null;
};

// Each segment links out; the ::after stretches the 28 px row to a 44 px touch target.
const segment = cn(
  "relative inline-flex h-7 items-center gap-1 px-2.5 text-xs font-semibold text-paper after:absolute after:inset-x-0 after:-inset-y-2 motion-safe:transition-transform motion-safe:active:scale-[0.97]",
  focusRing,
);

const METACRITIC_SWATCH: Record<MetacriticTier, string> = {
  good: "bg-[#54b948] text-[#0b1a0b]",
  mixed: "bg-[#f2c83a] text-[#1a1400]",
  bad: "bg-[#c9343a] text-white",
};

const Divider = () => <span className="h-3.5 w-px shrink-0 bg-white/14" aria-hidden="true" />;

/**
 * Ficha «Píldora de críticas» (FIL-I36, canvas option B): IMDb, Rotten Tomatoes
 * and Metacritic in one glass pill. A score OMDb did not send is simply not
 * drawn; with none of the three the pill is not drawn at all.
 */
export const CriticsPill = ({ name, imdbRating, imdbHref, rtScore, metascore }: CriticsPillProps) => {
  const parts = [
    imdbRating != null ? (
      imdbHref ? (
        <a
          key="imdb"
          href={imdbHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`IMDb ${imdbRating.toFixed(1)} de 10: abrir en IMDb`}
          className={cn(segment, "pl-1")}
        >
          <ImdbBadge rating={imdbRating} compact />
        </a>
      ) : (
        <span key="imdb" className={cn(segment, "pl-1")}>
          <ImdbBadge rating={imdbRating} compact />
        </span>
      )
    ) : null,
    rtScore != null ? (
      <a
        key="rt"
        href={rottenTomatoesSearchUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Rotten Tomatoes ${rtScore} %`}
        className={segment}
      >
        {rtIsFresh(rtScore) ? <TomatoGlyph /> : <SplatGlyph />}
        {rtScore}%
      </a>
    ) : null,
    metascore != null ? (
      <a
        key="mc"
        href={metacriticSearchUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Metacritic ${metascore} de 100`}
        className={cn(segment, "pr-1.5")}
      >
        <span
          className={cn(
            "inline-flex size-[18px] items-center justify-center rounded-[4px] text-[10px] font-bold tabular-nums",
            METACRITIC_SWATCH[metacriticTier(metascore)],
          )}
        >
          {metascore}
        </span>
      </a>
    ) : null,
  ].filter((part) => part != null);

  if (parts.length === 0) {
    return null;
  }

  return (
    <span className="liquid-glass liquid-glass-pill relative inline-flex h-7 items-center rounded-full" role="group" aria-label="Calificaciones">
      {parts.flatMap((part, index) => (index === 0 ? [part] : [<Divider key={`d${index}`} />, part]))}
    </span>
  );
};

const TomatoGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
    <circle cx="12" cy="13.5" r="8" fill="#fa320a" />
    <path d="M8 5.5c1.6.4 2.8 1.3 4 2.6 1.2-1.3 2.4-2.2 4-2.6-.6 1.7-1.9 3-4 3.4-2.1-.4-3.4-1.7-4-3.4Z" fill="#3e9b3a" />
  </svg>
);

const SplatGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
    <path
      d="M12 3.5c1 2.2 2.4 2.8 4.4 1.6-.3 2.3.6 3.5 3 3.6-1.5 1.8-1.4 3.3.6 4.6-2.2.7-2.8 2.1-1.7 4.3-2.3-.4-3.6.5-3.8 2.9-1.5-1.8-3-1.8-4.5 0-.3-2.4-1.6-3.3-3.9-2.9 1.1-2.2.5-3.6-1.7-4.3 2-1.3 2.1-2.8.6-4.6 2.4-.1 3.3-1.3 3-3.6 2 1.2 3.4.6 4-1.6Z"
      fill="#7cb342"
    />
  </svg>
);
