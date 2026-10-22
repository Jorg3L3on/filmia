import { formatShortDay } from "@/lib/cine-core";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/** Chain carteleras (no film deep links: neither chain has a public API). Cinemex opens its app via Universal Links. */
export const CHAINS = [
  { name: "Cinépolis", now: "https://cinepolis.com/cartelera", upcoming: "https://cinepolis.com/proximos-estrenos" },
  { name: "Cinemex", now: "https://cinemex.com/cartelera", upcoming: "https://cinemex.com/proximamente" },
] as const;

/**
 * Ficha badge (FIL-I17-4): «● En cines» while it shows, «Llega el 6 nov» before; never both, and
 * none once it streams in MX (the caller decides that). Under it, the chains' carteleras.
 */
export const CinemaBadge = ({ release }: { release: { status: "now" | "upcoming"; mxReleaseDate: string } }) => {
  const showing = release.status === "now";
  return (
    <div className="space-y-2">
      {showing ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-cine px-3 py-1 text-sm font-semibold text-ink shadow-[0_0_18px_rgb(var(--cine-rgb)/0.45)]">
          <span className="size-1.5 rounded-full bg-ink" aria-hidden="true" />
          En cines
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full border border-cine/70 px-3 py-1 text-sm font-semibold text-cine">
          Llega el {formatShortDay(release.mxReleaseDate)}
        </span>
      )}
      <p className="text-xs text-mist">
        Ver horarios en{" "}
        {CHAINS.map((chain, index) => (
          <span key={chain.name}>
            {index > 0 ? " · " : null}
            <a
              href={showing ? chain.now : chain.upcoming}
              target="_blank"
              rel="noopener"
              className={cn("font-medium text-fog underline-offset-2 hover:text-paper hover:underline", focusRing)}
            >
              {chain.name}
              <span aria-hidden="true"> ↗</span>
            </a>
          </span>
        ))}
      </p>
    </div>
  );
};
