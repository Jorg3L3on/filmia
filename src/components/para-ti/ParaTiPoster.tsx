import Link from "next/link";
import { AffinityChip } from "@/components/affinity/AffinityChip";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import type { ParaTiTitle } from "@/lib/para-ti/rank";
import { previewFichaHref } from "@/lib/title-preview";
import { focusRing, posterFrame } from "@/lib/ui";

export const paraTiMeta = (title: Pick<ParaTiTitle, "year" | "runtimeMinutes" | "kind">) =>
  [title.year, title.kind === "SERIES" ? "Serie" : title.runtimeMinutes ? `${title.runtimeMinutes} min` : null]
    .filter(Boolean)
    .join(" · ");

/**
 * A Para ti title as a poster with its name, year, platform and affinity level (FIL-I60-4). The
 * affinity chip shows the level only, never the «Para ti» label (pinned decision).
 */
export const ParaTiPoster = ({ title, className, priority = false }: { title: ParaTiTitle; className?: string; priority?: boolean }) => (
  <article role="listitem" className={cn("min-w-0", className)} data-ficha={title.catalogId}>
    <Link
      href={previewFichaHref(title.kind, title.tmdbId)}
      aria-label={`${title.name}${title.year ? ` (${title.year})` : ""}`}
      className={cn("group block card-physics press-scale", focusRing)}
    >
      <PosterImage name={title.name} posterPath={title.posterPath} className={posterFrame} sizes="140px" priority={priority} />
      <h3 className="mt-2 line-clamp-2 font-serif text-sm leading-tight text-paper group-hover:text-accent">{title.name}</h3>
      <p className="mt-0.5 truncate text-[11px] text-mist">
        {[paraTiMeta(title), title.platform ? PLATFORM_SERVICE_LABEL[title.platform] : null].filter(Boolean).join(" · ")}
      </p>
      {title.affinity ? (
        <AffinityChip level={title.affinity.level} label={title.affinity.label} lowConfidence={title.affinity.lowConfidence} className="mt-1" />
      ) : null}
    </Link>
  </article>
);
