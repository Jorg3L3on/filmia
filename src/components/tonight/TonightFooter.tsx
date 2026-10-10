"use client";

import Link from "next/link";
import { useTonight } from "@/components/tonight/TonightContext";
import { PlatformLogo } from "@/components/PlatformLogo";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL, TITLE_KIND_LABEL } from "@/lib/labels";
import { primaryAvailabilityPlatform } from "@/lib/streaming-platforms";
import { formatRuntimeShort } from "@/lib/tonight/time";
import { reasonPerson } from "@/lib/watchlist-credits";
import { buildPersonSearchHref } from "@/lib/person-filmography";
import { focusRing, personLinkClass } from "@/lib/ui";

type TonightFooterProps = {
  title: CoverflowTitle;
  className?: string;
};

/** Esta noche card footer: title, meta, the «why» pill and the decision chips. */
export const TonightFooter = ({ title, className }: TonightFooterProps) => {
  const tonight = title.tonight;
  const sala = useTonight();
  const genreNames = (title.genres ?? []).map((genre) => genre.name).filter(Boolean).slice(0, 3);
  const metaParts: string[] = [];
  if (title.year) {
    metaParts.push(String(title.year));
  }
  if (title.kind === "SERIES") {
    metaParts.push(TITLE_KIND_LABEL.SERIES);
  }
  metaParts.push(...(genreNames.length > 0 ? genreNames : [TITLE_KIND_LABEL[title.kind]]));

  const platform = primaryAvailabilityPlatform(title.flatrateProviders, title.platform);
  const platformLabel = platform
    ? PLATFORM_SERVICE_LABEL[platform]
    : (title.flatrateProviders?.[0]?.name ?? null);
  const runtime = formatRuntimeShort(tonight?.runtimeMinutes ?? null);
  const headline = tonight?.headline[0] ?? null;
  const headlinePerson = reasonPerson(headline, tonight?.leads ?? []);
  // By day the chip is just the runtime: «acaba 15:31» only means something at night.
  const night = (sala?.dayPart ?? "noche") === "noche";
  const fit = night ? (tonight?.fit ?? null) : null;
  const overflow = Boolean(fit && fit.overflowMinutes > 0);
  const nightOver = Boolean(fit && fit.remainingMinutes === 0);
  const recommended = tonight?.source === "reco";
  const recoSaved = Boolean(recommended && tonight?.reco?.saved);

  return (
    <div className={cn("tonight-footer mx-auto flex w-full max-w-xl flex-col items-center gap-2 text-center", className)}>
      <div key={title.id} className="tonight-title-in space-y-1 px-2">
        {tonight?.pinned ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            Tu elección de esta noche
          </p>
        ) : recommended ? (
          <p className="reco-eyebrow">
            {recoSaved ? "Ya está en Quiero ver" : "Recomendada · no está en Quiero ver"}
          </p>
        ) : null}
        <h2 className="tonight-title font-serif text-[1.55rem] font-semibold leading-tight text-paper sm:text-3xl md:text-4xl">
          {recommended ? (
            <button
              type="button"
              onClick={() => sala?.onOpenReco(title)}
              className={cn("text-inherit hover:text-accent", focusRing)}
            >
              {title.name}
            </button>
          ) : (
            <Link
              href={`/titulos/${title.id}`}
              onClick={() => sala?.onOpened(title)}
              className={cn("hover:text-accent", focusRing)}
            >
              {title.name}
            </Link>
          )}
        </h2>
        <p className="tonight-meta text-[13px] font-medium text-paper/85 sm:text-sm">
          {metaParts.map((part, index) => (
            <span key={`${part}-${index}`}>
              {index > 0 ? <span className="text-paper/70"> · </span> : null}
              <span>{part}</span>
            </span>
          ))}
        </p>
      </div>

      {headline && headlinePerson ? (
        // «Dirigida por X»: the spark half still opens «Por qué», the name opens
        // X's filmography in Buscar. Two siblings, so no link inside a button.
        <span className="tonight-reason tonight-reason-split">
          <button
            type="button"
            onClick={() => sala?.onWhy(title)}
            aria-label={`Por qué te proponemos ${title.name}: ${headline.text}`}
            className={cn("press-scale inline-flex shrink-0 items-center gap-1.5", focusRing)}
          >
            <SparkIcon />
            <span aria-hidden="true">{title.kind === "SERIES" ? "Creada" : "Dirigida"} por</span>
          </button>
          <Link
            href={buildPersonSearchHref({
              personId: headlinePerson.id,
              role: "director",
              name: headlinePerson.name,
            })}
            aria-label={`Ver la filmografía de ${headlinePerson.name}`}
            className={cn("tonight-reason-person press-scale truncate", personLinkClass)}
          >
            {headlinePerson.name}
          </Link>
        </span>
      ) : headline ? (
        <button
          type="button"
          onClick={() => sala?.onWhy(title)}
          aria-label={`Por qué te proponemos ${title.name}: ${headline.text}`}
          className={cn("tonight-reason press-scale", focusRing)}
        >
          <SparkIcon />
          <span className="truncate">{headline.text}</span>
        </button>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {title.imdbRating != null ? (
          <span className="tonight-chip" title={`IMDb ${title.imdbRating.toFixed(1)}/10`}>
            <span className="tonight-chip-imdb">IMDb</span>
            <span className="font-semibold text-imdb">{title.imdbRating.toFixed(1)}</span>
          </span>
        ) : null}
        {platformLabel ? (
          <span className="tonight-chip">
            {platform ? (
              <PlatformLogo platform={platform} size={16} className="rounded-[4px]" />
            ) : null}
            {platformLabel}
          </span>
        ) : null}
        {runtime ? (
          <span className={cn("tonight-chip", overflow && "is-over")}>
            <ClockIcon />
            {runtime}
            {fit && fit.endsAt ? (
              <span className={overflow ? "text-[#f0b35a]" : "text-fog"}>
                {nightOver
                  ? " · ya pasó tu hora"
                  : overflow
                    ? ` · se pasa ${fit.overflowMinutes} min`
                    : ` · acaba ${fit.endsAt}`}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true" className="shrink-0 text-accent-hover">
    <path d="M12 2.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z" />
    <path d="M5 15.5c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" className="text-fog">
    <circle cx="12" cy="12" r="8.5" />
    <path strokeLinecap="round" d="M12 7.5V12l3 2" />
  </svg>
);
