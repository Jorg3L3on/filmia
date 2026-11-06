"use client";

import Link from "next/link";
import { useState } from "react";
import { AffinityChip } from "@/components/affinity/AffinityChip";
import { PosterImage } from "@/components/PosterImage";
import { Sheet } from "@/components/Sheet";
import type { SearchRowStatus, SearchRowWiring } from "@/components/tmdb-search/SearchResultRow";
import { cn } from "@/lib/cn";
import { formatRuntime, formatStarScore, PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import type { FilmographyEntry } from "@/lib/person-filmography";
import {
  monthYearLabel,
  recorridoTitle,
  releaseDateLabel,
  type StripFrame,
  type watchedStrip,
} from "@/lib/person-view";
import type { SearchResultFacts } from "@/lib/search-result-facts";
import { focusRing } from "@/lib/ui";

type StatusOf = (entry: FilmographyEntry) => { titleId: string | null; status: SearchRowStatus };

/**
 * «Tu recorrido» (FIL-I45-3): the ring with how many you watched and a headline that speaks, the
 * film strip with what you watched first (stars and date), what waits in Quiero ver, the rest dimmed,
 * and «Siguiente para ti». Replaces the bar of anonymous marks.
 */

const RING_R = 47;
const RING_C = 2 * Math.PI * RING_R;

export const ProgressRing = ({ watched, total }: { watched: number; total: number }) => {
  const share = total > 0 ? Math.min(1, watched / total) : 0;
  const percent = Math.round(share * 100);
  const full = total > 0 && watched >= total;
  return (
    <svg
      viewBox="0 0 112 112"
      className="persona-ring size-[96px] shrink-0 drop-shadow-[0_0_18px_rgb(61_214_140/0.4)] min-[360px]:size-[108px]"
      role="img"
      aria-label={`${watched} de ${total} vistas, ${percent} por ciento`}
      style={{ ["--ring-c" as string]: RING_C, ["--ring-to" as string]: RING_C * (1 - share) }}
    >
      <defs>
        <linearGradient id="persona-ring-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3dd68c" />
          <stop offset="1" stopColor="#c8f7e1" />
        </linearGradient>
      </defs>
      <circle cx="56" cy="56" r={RING_R} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="9" />
      {share > 0 ? (
        <circle
          className="persona-ring-arc"
          cx="56"
          cy="56"
          r={RING_R}
          fill="none"
          stroke="url(#persona-ring-g)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - share)}
          transform="rotate(-90 56 56)"
        />
      ) : null}
      {full ? (
        <path d="m40 57 11 11 21-23" fill="none" stroke="#3dd68c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          {/* Keyed by the count: marking one as seen rolls the number in again (FIL-I45-6). */}
          <text key={watched} x="56" y="57" textAnchor="middle" className="persona-tick fill-paper font-serif" fontSize="38" fontWeight="600">
            {watched}
          </text>
          <text x="56" y="77" textAnchor="middle" className="fill-fog" fontSize="11.5" letterSpacing="1.5">
            DE {total}
          </text>
        </>
      )}
    </svg>
  );
};

const Check = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "absolute flex items-center justify-center rounded-full bg-success text-ink shadow-[0_0_0_2px_var(--canvas),0_0_14px_rgb(61_214_140/0.6)]",
      className,
    )}
    aria-hidden="true"
  >
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5 9-10" />
    </svg>
  </span>
);

const frameLabel = (frame: StripFrame) =>
  frame.state === "watched"
    ? `${frame.entry.name}, vista${frame.rating != null ? `, ${formatStarScore(frame.rating)} estrellas` : ""}${frame.on ? `, ${monthYearLabel(frame.on)}` : ""}`
    : frame.state === "watchlist"
      ? `${frame.entry.name}, en Quiero ver`
      : `${frame.entry.name}, sin ver`;

/** One frame of the strip: the poster, then the stars and month for a watched one. */
const StripCell = ({ frame, statusOf, rows }: { frame: StripFrame; statusOf: StatusOf; rows: SearchRowWiring }) => {
  const { entry, state } = frame;
  return (
    <li className="w-[74px] shrink-0">
      <Link
        href={rows.hrefFor(entry, statusOf(entry).titleId)}
        prefetch={false}
        onClick={() => rows.onOpen(entry)}
        aria-label={frameLabel(frame)}
        className={cn("press-scale flex flex-col items-center gap-1.5 rounded-md", focusRing)}
      >
        <span className="relative block w-[74px] overflow-hidden rounded-md shadow-[0_18px_36px_-14px_rgb(0_0_0/0.9)]">
          <span className={cn("block", state !== "watched" && "opacity-[0.22] grayscale-[0.7]")}>
            <PosterImage name={entry.name} posterPath={entry.posterPath} sizes="74px" tmdbSize="w185" />
          </span>
          {state === "watched" ? <Check className="top-1.5 right-1.5 size-5" /> : null}
          {state === "watchlist" ? (
            <span className="absolute top-1.5 left-1.5 size-3.5 rounded-full border-[1.5px] border-accent-hover" aria-hidden="true" />
          ) : null}
        </span>
        <span className={cn("block max-w-full truncate text-[10.5px]", state === "watched" ? "text-paper" : "text-fog")}>
          {entry.name}
        </span>
        <span className="block whitespace-nowrap text-[10px] text-fog">
          {state === "watched" ? (
            <>
              {frame.rating != null ? (
                <span className="font-semibold text-star">★ {formatStarScore(frame.rating)}</span>
              ) : (
                <span className="text-success">Vista</span>
              )}
              {frame.on ? ` · ${monthYearLabel(frame.on)}` : null}
            </>
          ) : state === "watchlist" ? (
            <span className="text-accent-hover">Quiero ver</span>
          ) : (
            "sin ver"
          )}
        </span>
      </Link>
    </li>
  );
};

/** «Siguiente para ti»: the one card of the view, lit by its own poster. */
const NextCard = ({
  entry,
  facts,
  statusOf,
  rows,
  label,
}: {
  entry: FilmographyEntry;
  facts: SearchResultFacts | null;
  statusOf: StatusOf;
  rows: SearchRowWiring;
  label: string;
}) => {
  const detail = [
    facts?.minePlatform ? PLATFORM_SERVICE_LABEL[facts.minePlatform] : facts?.platform,
    formatRuntime(facts?.runtimeMinutes ?? null),
  ].filter(Boolean);
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-affinity/35 bg-surface p-3.5 shadow-[0_0_0_1px_rgb(var(--affinity-rgb)/0.08),0_24px_48px_-22px_rgb(var(--affinity-rgb)/0.45)]">
      <span className="pointer-events-none absolute -top-16 -right-14 block w-[200px] opacity-40 blur-[34px]" aria-hidden="true">
        <PosterImage name="" posterPath={entry.posterPath} sizes="120px" tmdbSize="w185" />
      </span>
      <div className="relative flex items-center gap-3">
        <Link
          href={rows.hrefFor(entry, statusOf(entry).titleId)}
          prefetch={false}
          onClick={() => rows.onOpen(entry)}
          className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-lg", focusRing)}
        >
          <span className="block w-[52px] shrink-0 overflow-hidden rounded-lg shadow-[0_18px_36px_-14px_rgb(0_0_0/0.9)]">
            <PosterImage name={entry.name} posterPath={entry.posterPath} sizes="52px" tmdbSize="w185" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[10px] font-medium tracking-[0.18em] text-affinity uppercase">{label}</span>
            <span className="mt-0.5 line-clamp-2 block font-serif text-[20px] leading-tight tracking-[-0.01em] text-paper">
              {entry.name}
            </span>
            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-fog">
              {facts?.affinity ? (
                <AffinityChip
                  level={facts.affinity.level}
                  label={facts.affinity.label}
                  lowConfidence={facts.affinity.lowConfidence}
                />
              ) : null}
              {detail.length > 0 ? <span className="truncate">{detail.join(" · ")}</span> : null}
            </span>
          </span>
        </Link>
        {rows.onPinTonight ? (
          <button
            type="button"
            onClick={() => rows.onPinTonight?.(entry)}
            className={cn(
              "press-scale h-11 shrink-0 rounded-full bg-linear-to-b from-accent-hover to-accent px-4 text-[13px] font-semibold text-ink shadow-[0_12px_26px_-10px_rgb(var(--accent-rgb)/0.9)]",
              focusRing,
            )}
          >
            Esta noche
          </button>
        ) : null}
      </div>
    </div>
  );
};

/** «Ver todas»: every watched title, latest first, with stars and the day. */
const WatchedSheet = ({
  open,
  onClose,
  frames,
  statusOf,
  rows,
  today,
}: {
  open: boolean;
  onClose: () => void;
  frames: StripFrame[];
  statusOf: StatusOf;
  rows: SearchRowWiring;
  today: string;
}) => (
  <Sheet open={open} onClose={onClose} label="Las que viste">
    <div className="space-y-3 px-4 pt-2 pb-4">
      <h3 className="font-serif text-2xl text-paper">Las que viste</h3>
      {frames.length === 0 ? (
        <p className="text-sm text-fog">Aún no has visto nada de su obra.</p>
      ) : (
        <ul className="max-h-[60vh] divide-y divide-white/6 overflow-y-auto" data-no-sheet-drag>
          {frames.map((frame) => (
            <li key={`${frame.entry.kind}:${frame.entry.tmdbId}`}>
              <Link
                href={rows.hrefFor(frame.entry, statusOf(frame.entry).titleId)}
                prefetch={false}
                onClick={() => {
                  rows.onOpen(frame.entry);
                  onClose();
                }}
                className={cn("flex min-h-14 items-center gap-3 rounded-lg py-2.5", focusRing)}
              >
                <span className="block w-10 shrink-0 overflow-hidden rounded-md">
                  <PosterImage name={frame.entry.name} posterPath={frame.entry.posterPath} sizes="40px" tmdbSize="w185" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-base text-paper">{frame.entry.name}</span>
                  <span className="block text-xs text-fog">
                    {frame.rating != null ? <span className="font-semibold text-star">★ {formatStarScore(frame.rating)} · </span> : null}
                    {frame.on ? `Vista el ${releaseDateLabel(frame.on, today)}` : "Vista"}
                    {frame.entry.year ? ` · ${frame.entry.year}` : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  </Sheet>
);

export const PersonJourney = ({
  progress,
  strip,
  next,
  statusOf,
  rows,
  today,
}: {
  progress: { watched: number; watchlist: number; total: number };
  strip: ReturnType<typeof watchedStrip>;
  next: { entry: FilmographyEntry; source: "taste" | "essential" } | null;
  statusOf: StatusOf;
  rows: SearchRowWiring;
  today: string;
}) => {
  const [sheet, setSheet] = useState(false);
  const { watched, watchlist, total } = progress;
  const done = total > 0 && watched >= total;
  const last = strip.last;
  return (
    <section aria-label="Tu recorrido" className="persona-journey space-y-4">
      <div className="flex items-center gap-4">
        <ProgressRing watched={watched} total={total} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-medium tracking-[0.22em] text-success uppercase">Tu recorrido</p>
          <h3 className="mt-1.5 font-serif text-[24px] leading-[1.05] tracking-[-0.015em] text-paper min-[360px]:text-[27px]">
            {recorridoTitle(watched, total)}
          </h3>
          <p className="mt-2 text-[12.5px] leading-snug text-fog">
            {watched} {watched === 1 ? "vista" : "vistas"} · {watchlist} en Quiero ver
            {last?.on ? (
              <>
                <br />
                La última: <span className="text-paper">{last.entry.name}</span>, {releaseDateLabel(last.on, today)}
              </>
            ) : null}
          </p>
        </div>
      </div>

      {watched > 0 ? (
        <div className="persona-strip -mx-4 sm:mx-0 sm:rounded-2xl">
          <ul className="persona-strip-in flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none]">
            {strip.frames.map((frame) => (
              <StripCell key={`${frame.entry.kind}:${frame.entry.tmdbId}`} frame={frame} statusOf={statusOf} rows={rows} />
            ))}
            <li className="w-[74px] shrink-0">
              <button
                type="button"
                onClick={() => setSheet(true)}
                className={cn("press-scale flex w-full flex-col items-center gap-1.5 rounded-md", focusRing)}
              >
                <span className="flex aspect-[2/3] w-full items-center justify-center rounded-md bg-surface font-serif text-xl text-fog ring-1 ring-line ring-inset">
                  {strip.more > 0 ? `+${strip.more}` : "Todas"}
                </span>
                <span className="text-[10.5px] text-fog">Ver todas</span>
                <span className="text-[10px] text-fog">{watched} vistas</span>
              </button>
            </li>
          </ul>
        </div>
      ) : null}

      {next && !done ? (
        <NextCard
          entry={next.entry}
          facts={rows.factsFor?.(next.entry) ?? null}
          statusOf={statusOf}
          rows={rows}
          label={watched === 0 ? "Empieza por" : "Siguiente para ti"}
        />
      ) : null}

      <WatchedSheet
        open={sheet}
        onClose={() => setSheet(false)}
        frames={strip.watched}
        statusOf={statusOf}
        rows={rows}
        today={today}
      />
    </section>
  );
};
