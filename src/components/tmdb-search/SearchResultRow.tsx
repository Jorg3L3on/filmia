"use client";

import Link from "next/link";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { AffinityChip } from "@/components/affinity/AffinityChip";
import { ImdbBadge } from "@/components/ImdbBadge";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { LaurelIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import { formatRuntime, formatStarScore, TITLE_KIND_LABEL } from "@/lib/labels";
import { menuVia, type SearchMenuVia } from "@/components/tmdb-search/SearchRowMenu";
import { useLongPress } from "@/lib/motion";
import type { SearchResultFacts } from "@/lib/search-result-facts";
import type { TmdbCatalogResult } from "@/lib/tmdb";
import { diaryDayLabel } from "@/lib/title-preview";
import { focusRing, glassRowClass } from "@/lib/ui";

/** Where the title already is in the user's Filmia. */
export type SearchRowStatus = "watched" | "watchlist" | null;

/**
 * Diario mode (FIL-I22-3): the row's chevron becomes a 40 px check that logs
 * the viewing on `date` without opening the ficha; `logged` once it did here.
 */
export type SearchRowLog = {
  date: string | null;
  logged: boolean;
  pending: boolean;
  onLog: () => void;
};

type SearchResultRowProps = {
  result: TmdbCatalogResult;
  /** Local title id: the poster flies to the ficha (SharedPoster) when set. */
  titleId?: string | null;
  /** Extra meta after «año · tipo» (e.g. the character in a cast filmography). */
  detail?: ReactNode;
  status?: SearchRowStatus;
  /** IMDb, award, runtime and platform from the shared Catalog (FIL-I8-4); `pending` while it fills. */
  facts?: SearchResultFacts | null;
  /** The ficha: the user's own, or the preview by TMDB (FIL-I8). */
  href: string;
  /** Tap: the row is leaving for its ficha (Buscar remembers the query). */
  onOpen?: (result: TmdbCatalogResult) => void;
  /** Long press / right click: the shortcuts menu, anchored to this row; `via` says touch or not. */
  onMenu?: (result: TmdbCatalogResult, anchor: DOMRect, via: SearchMenuVia) => void;
  /** Diario mode: the check that logs this row on the day (FIL-I22-3). */
  log?: SearchRowLog | null;
};

/** How Buscar wires every row (results, filmographies): where it goes, what holding it does. */
export type SearchRowWiring = {
  hrefFor: (result: TmdbCatalogResult, titleId: string | null) => string;
  onOpen: (result: TmdbCatalogResult) => void;
  onMenu: (result: TmdbCatalogResult, anchor: DOMRect, via: SearchMenuVia) => void;
  factsFor?: (result: TmdbCatalogResult) => SearchResultFacts | null;
  /** Diario mode: the check for each row (null outside Diario). */
  logFor?: (result: TmdbCatalogResult) => SearchRowLog | null;
};

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Poster key for the morph: the local title, else the film (the ficha preview uses the same). */
export const searchPosterKey = (result: Pick<TmdbCatalogResult, "kind" | "tmdbId">, titleId?: string | null) =>
  titleId && !titleId.startsWith("pending:") ? titleId : `tmdb-${result.kind}-${result.tmdbId}`;

/**
 * One Buscar result, «Fichas» direction with row A «Línea de datos» (FIL-I8):
 * glass row, serif title, «año · duración · tipo · género», then IMDb · premio ·
 * plataforma, and where it already lives in your Filmia. The whole row is the
 * link to the ficha; holding it opens the shortcuts.
 */
export const SearchResultRow = ({
  result,
  titleId,
  detail,
  status = null,
  facts = null,
  href,
  onOpen,
  onMenu,
  log = null,
}: SearchResultRowProps) => {
  const rowRef = useRef<HTMLAnchorElement>(null);
  const firedRef = useRef(false);
  const openMenu = (pointerType: string) => {
    const node = rowRef.current;
    if (!onMenu || !node) {
      return;
    }
    firedRef.current = true;
    navigator.vibrate?.(8);
    onMenu(result, node.getBoundingClientRect(), menuVia(pointerType));
  };
  const longPress = useLongPress(openMenu);

  const link = (
    <Link
      ref={rowRef}
      href={href}
      prefetch={false}
      data-search-row={`${result.kind}:${result.tmdbId}`}
      onClickCapture={(event) => {
        // The long press already opened the menu: the release is not a tap.
        if (firedRef.current) {
          firedRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onClick={() => onOpen?.(result)}
      onContextMenu={(event) => {
        if (!onMenu) {
          return;
        }
        event.preventDefault();
        openMenu("mouse");
        // A right click never ends in a click: nothing to swallow.
        firedRef.current = false;
      }}
      {...(onMenu
        ? {
            ...longPress,
            onPointerDown: (event: PointerEvent) => {
              // A new gesture: whatever the last hold left behind is not this tap's.
              firedRef.current = false;
              longPress.onPointerDown(event);
            },
          }
        : {})}
      className={cn(
        glassRowClass,
        "group card-physics press-scale flex w-full min-w-0 select-none items-center gap-3 p-2.5 text-left [-webkit-touch-callout:none]",
        "transition-[border-color,background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-accent/40",
        status === "watchlist" && "border-accent/30",
        // Diario: room for the check button that sits over the row's right edge.
        log && "pr-14",
        focusRing,
      )}
    >
      <SearchResultRowBody
        result={result}
        titleId={titleId}
        detail={detail}
        status={status}
        facts={facts}
        loggedOn={log?.logged ? log.date : undefined}
        chevron={!log}
        morph
      />
    </Link>
  );

  if (!log) {
    return link;
  }
  // A button cannot live inside the link: it floats over the row's right edge instead.
  const day = diaryDayLabel(log.date);
  return (
    <span className="relative block">
      {link}
      <button
        type="button"
        aria-label={log.logged ? `Registrada · ${day}` : `Registrar vista · ${day}`}
        aria-pressed={log.logged}
        disabled={log.logged || log.pending}
        onClick={log.onLog}
        data-search-log={log.logged ? "done" : log.pending ? "pending" : "ready"}
        className={cn(
          "press-scale absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full transition-[background-color,color] duration-[var(--duration-hover)]",
          log.logged
            ? "bg-success text-ink"
            : "bg-success-well text-success hover:bg-success/25",
          log.pending && "animate-pulse",
          focusRing,
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5 9.5-10" />
        </svg>
      </button>
    </span>
  );
};

/** The row's content; the menu's lifted copy reuses it without the link or the morph. */
export const SearchResultRowBody = ({
  result,
  titleId,
  detail,
  status = null,
  facts = null,
  loggedOn,
  chevron = true,
  morph = false,
}: Pick<SearchResultRowProps, "result" | "titleId" | "detail" | "status" | "facts"> & {
  /** Diario: the day this row was just logged on (null = today); the pill says «Registrada · día». */
  loggedOn?: string | null;
  /** The trailing chevron; Diario rows put their check button there instead. */
  chevron?: boolean;
  morph?: boolean;
}) => {
  const poster = (
    <PosterImage
      name={result.name}
      posterPath={result.posterPath}
      sizes="56px"
      tmdbSize="w185"
      className="rounded-poster"
    />
  );
  const original =
    result.originalName && !sameTitle(result.originalName, result.name) ? result.originalName : null;
  const meta = [
    result.year ? String(result.year) : null,
    formatRuntime(facts?.runtimeMinutes ?? null),
    TITLE_KIND_LABEL[result.kind],
    facts?.genre ?? null,
  ].filter(Boolean);

  return (
    <>
      <span className="w-14 shrink-0 overflow-hidden rounded-poster shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110">
        <SharedPoster titleId={searchPosterKey(result, titleId)} share={morph}>
          {poster}
        </SharedPoster>
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="line-clamp-2 font-serif text-[17px] leading-snug text-pretty break-words text-paper">
          {result.name}
        </span>
        <span className="block truncate text-[13px] text-fog">
          {meta.join(" · ")}
          {detail ? <> · {detail}</> : null}
        </span>
        {original ? <span className="block truncate text-xs italic text-mist">{original}</span> : null}
        <SearchFactsLine facts={facts} />
        {loggedOn !== undefined ? (
          <LibraryPill status="watched" label={`Registrada · ${diaryDayLabel(loggedOn)}`} />
        ) : status ? (
          <LibraryPill status={status} />
        ) : null}
      </span>
      {chevron ? (
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0 text-faint transition-[transform,color] duration-[var(--duration-hover)] ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      ) : null}
    </>
  );
};

/**
 * Row A's data line, in two lines since FIL-I22-2 (línea A «Dos renglones»):
 * (1) IMDb · «Para ti» or your rating; (2) laurel + the whole award · platform.
 * A line only when it has something, so a row grows 16 px per line and
 * nothing is ever cut mid-word («1 Ós»). Nothing without data (the ficha says
 * «Aún sin calificación»; a row stays quiet). While the Catalog fills, two
 * pills hold one line's height so nothing jumps.
 */
const SearchFactsLine = ({ facts }: { facts: SearchResultFacts | null }) => {
  if (!facts) {
    return null;
  }
  if (facts.pending) {
    return (
      <span className="flex h-4 items-center gap-1.5" aria-hidden="true">
        <span className="shimmer inline-block h-3 w-12 rounded-full" />
        <span className="shimmer inline-block h-3 w-16 rounded-full" />
      </span>
    );
  }
  const first: ReactNode[] = [];
  const second: ReactNode[] = [];
  if (facts.imdbRating != null) {
    first.push(<ImdbBadge key="imdb" rating={facts.imdbRating} compact />);
  }
  // «Para ti» (FIL-I9): a watched film shows your rating, never a prediction.
  if (facts.watched?.rating != null) {
    first.push(
      <span key="mine" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-star">
        ★ {formatStarScore(facts.watched.rating)}
        <span className="font-normal text-fog">tu nota</span>
      </span>,
    );
  } else if (facts.affinity) {
    first.push(
      <AffinityChip
        key="affinity"
        level={facts.affinity.level}
        label={facts.affinity.label}
        lowConfidence={facts.affinity.lowConfidence}
        className="shrink-0"
      />,
    );
  }
  if (facts.awardLabel) {
    second.push(
      <span key="award" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-star">
        <LaurelIcon />
        {facts.awardLabel}
      </span>,
    );
  }
  if (facts.platform) {
    second.push(
      <span key="platform" className="min-w-0 truncate text-xs text-paper/75">
        {facts.platform}
      </span>,
    );
  }
  if (first.length === 0 && second.length === 0) {
    return null;
  }
  return (
    <span className="block" data-search-facts={second.length > 0 ? "2" : "1"}>
      {first.length > 0 ? <FactsRow bits={first} /> : null}
      {second.length > 0 ? <FactsRow bits={second} /> : null}
    </span>
  );
};

/** One 16 px line of facts, « · » between them; only the last one may truncate. */
const FactsRow = ({ bits }: { bits: ReactNode[] }) => (
  <span className="flex h-4 min-w-0 items-center gap-1.5 overflow-hidden">
    {bits.map((bit, index) => (
      <span key={index} className={cn("inline-flex items-center gap-1.5", index === bits.length - 1 ? "min-w-0" : "shrink-0")}>
        {index > 0 ? <span className="text-xs text-faint" aria-hidden="true">·</span> : null}
        {bit}
      </span>
    ))}
  </span>
);

/** «En Quiero ver» (accent) or «La viste» (success): where it already is; Diario says «Registrada · día». */
const LibraryPill = ({ status, label }: { status: Exclude<SearchRowStatus, null>; label?: string }) => (
  <span
    className={cn(
      "mt-0.5 inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
      status === "watchlist" ? "bg-accent/15 text-accent-hover" : "bg-success-well text-success",
    )}
  >
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {status === "watchlist" ? (
        <path fill="currentColor" d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z" />
      ) : (
        <path d="m5 12 5 5 9-10" />
      )}
    </svg>
    {label ?? (status === "watchlist" ? "En Quiero ver" : "La viste")}
  </span>
);
