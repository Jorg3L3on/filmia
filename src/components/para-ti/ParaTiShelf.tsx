"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/motion";
import type { ParaTiTitle } from "@/lib/para-ti/rank";
import {
  SHELF_DESKTOP,
  SHELF_PHONE,
  centerAt,
  clamp,
  mountedRange,
  poseTransform,
  scrollFor,
  spinePose,
  surpriseIndex,
  windowAnchor,
  type ShelfDims,
} from "@/lib/para-ti/shelf-geometry";
import { spineLabel } from "@/components/para-ti/spine-label";
import { previewFichaHref } from "@/lib/title-preview";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { focusRing } from "@/lib/ui";

type ParaTiShelfProps = {
  titles: ParaTiTitle[];
  /** Where the centred title is remembered (antojo + filters), so back from a ficha lands on it. */
  memoryKey: string;
  label: string;
  /** The antojo's motion personality: how far spines lean with speed. */
  lean: number;
  /** The centred title's card and actions (F6), drawn under the shelf. */
  renderCenter: (title: ParaTiTitle) => ReactNode;
};

const subscribeWide = (onChange: () => void) => {
  const media = window.matchMedia("(min-width: 640px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const readWide = () => window.matchMedia("(min-width: 640px)").matches;
const useDims = (): ShelfDims => (useSyncExternalStore(subscribeWide, readWide, () => false) ? SHELF_DESKTOP : SHELF_PHONE);

const CENTER_KEY = "filmia:para-ti-centro:";

/** Reduced motion: flat posters on the same snapping rail. */
const flatDims: ShelfDims = { slot: 124, depth: 124, height: 186 };

const readRemembered = (key: string) => {
  try {
    return window.sessionStorage.getItem(CENTER_KEY + key);
  } catch {
    return null;
  }
};

const remember = (key: string, catalogId: string) => {
  try {
    window.sessionStorage.setItem(CENTER_KEY + key, catalogId);
  } catch {
    // Private mode: back from a ficha starts at the first title.
  }
};

/**
 * The spine shelf (FIL-I60-5). Native horizontal scrolling gives the weight and momentum and the
 * snap keeps one title centred; every frame the boxes in a 25-title window are posed from the
 * scroll position (transforms and opacity only). The centred box turns a quarter to show its
 * cover. Keyboard: arrows move one title, Enter opens it. Reduced motion: a flat poster rail.
 */
export const ParaTiShelf = ({ titles, memoryKey, label, lean, renderCenter }: ParaTiShelfProps) => {
  const reduced = usePrefersReducedMotion();
  const dims = useDims();
  const trackRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<string, HTMLElement>());
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const frame = useRef(0);
  const lastCenter = useRef(0);
  const [center, setCenter] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [spinning, setSpinning] = useState(false);

  const indexById = useMemo(() => new Map(titles.map((title, index) => [title.catalogId, index])), [titles]);
  const current = titles[clamp(center, 0, Math.max(0, titles.length - 1))];

  /** Pose every mounted box for scroll position `at` (slots) and speed `velocity` (slots/frame). */
  const opacities = useRef(new WeakMap<HTMLElement, string>());
  const pose = useCallback(
    (at: number, velocity: number) => {
      if (reduced) return;
      for (const [id, slot] of slotRefs.current) {
        const index = indexById.get(id);
        if (index == null) continue;
        const distance = index - at;
        const p = spinePose(distance, dims, velocity, lean);
        const box = slot.firstElementChild as HTMLElement | null;
        if (!box) continue;
        // One scene for the whole shelf: every box is seen from the shelf's centre.
        box.style.transform = poseTransform(p, -distance * dims.slot);
        const opacity = p.opacity.toFixed(2);
        if (opacities.current.get(slot) !== opacity) {
          opacities.current.set(slot, opacity);
          slot.style.opacity = opacity;
        }
      }
    },
    [dims, indexById, lean, reduced],
  );

  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const track = trackRef.current;
      if (!track) return;
      const at = centerAt(track.scrollLeft, reduced ? flatDims : dims);
      const velocity = at - lastCenter.current;
      lastCenter.current = at;
      pose(at, velocity);
      const rounded = clamp(Math.round(at), 0, titles.length - 1);
      setCenter((previous) => (previous === rounded ? previous : rounded));
    });
  }, [dims, pose, reduced, titles.length]);

  // Straighten the lean once the shelf stops (scrollend, with a timer for browsers without it).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let timer = 0;
    const settle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lastCenter.current = centerAt(track.scrollLeft, reduced ? flatDims : dims);
        pose(lastCenter.current, 0);
      }, 90);
    };
    track.addEventListener("scroll", settle, { passive: true });
    track.addEventListener("scrollend", settle);
    return () => {
      window.clearTimeout(timer);
      track.removeEventListener("scroll", settle);
      track.removeEventListener("scrollend", settle);
    };
  }, [dims, pose, reduced]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const track = trackRef.current;
      if (!track) return;
      track.scrollTo({ left: scrollFor(clamp(index, 0, titles.length - 1), reduced ? flatDims : dims), behavior });
    },
    [dims, reduced, titles.length],
  );

  // First paint and every new list: keep the remembered (or the same) title centred, then pose.
  const previous = useRef<{ titles: ParaTiTitle[]; at: number } | null>(null);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const step = reduced ? flatDims : dims;
    const before = previous.current;
    const keepId = before ? before.titles[Math.round(before.at)]?.catalogId : readRemembered(memoryKey);
    const target = keepId != null && indexById.has(keepId) ? indexById.get(keepId)! : 0;
    track.scrollLeft = scrollFor(target, step);
    lastCenter.current = target;
    setCenter(target);
    pose(target, 0);

    // Reshuffle in place (FLIP): titles that stay slide from where they were, new ones rise.
    if (before && !reduced && typeof HTMLElement.prototype.animate === "function") {
      const oldIndex = new Map(before.titles.map((title, index) => [title.catalogId, index]));
      for (const [id, slot] of slotRefs.current) {
        const mover = slot.querySelector<HTMLElement>("[data-mover]");
        if (!mover) continue;
        const was = oldIndex.get(id);
        const now = indexById.get(id);
        if (was == null || now == null) {
          mover.animate(
            [
              { transform: "translateY(48px)", opacity: 0 },
              { transform: "translateY(0)", opacity: 1 },
            ],
            { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)", delay: Math.min(8, Math.abs((now ?? 0) - target)) * 24, fill: "backwards" },
          );
          continue;
        }
        const dx = (was - before.at - (now - target)) * step.slot;
        if (Math.abs(dx) < 1) continue;
        mover.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }], {
          duration: 420,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
      }
    }
    previous.current = { titles, at: target };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per list and per layout, not per pose
  }, [titles, dims, reduced]);

  // Keep the remembered centre and the reshuffle anchor current; announce the centred title.
  useEffect(() => {
    if (!current) return;
    remember(memoryKey, current.catalogId);
    if (previous.current) previous.current.at = center;
    const timer = window.setTimeout(() => setAnnounce(`${current.name}${current.year ? `, ${current.year}` : ""}`), 250);
    return () => window.clearTimeout(timer);
  }, [center, current, memoryKey]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Desktop: a vertical wheel moves the shelf (trackpads already scroll sideways).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || event.ctrlKey) return;
      const max = track.scrollWidth - track.clientWidth;
      const next = track.scrollLeft + event.deltaY;
      if ((next <= 0 && track.scrollLeft <= 0) || (next >= max && track.scrollLeft >= max)) return;
      event.preventDefault();
      track.scrollLeft = next;
    };
    track.addEventListener("wheel", onWheel, { passive: false });
    return () => track.removeEventListener("wheel", onWheel);
  }, []);

  const move = (to: number) => {
    const index = clamp(to, 0, titles.length - 1);
    scrollToIndex(index);
    const id = titles[index]?.catalogId;
    if (id) window.requestAnimationFrame(() => linkRefs.current.get(id)?.focus({ preventScroll: true }));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(center + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(center - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(titles.length - 1);
    }
  };

  // Stable across renders so memoised slots do not re-render when the centre moves; the link
  // itself says whether it is the centred one.
  const onItemClick = useCallback(
    (index: number, event: MouseEvent) => {
      if ((event.currentTarget as HTMLElement).getAttribute("aria-current") !== "true") {
        event.preventDefault();
        scrollToIndex(index);
      }
    },
    [scrollToIndex],
  );

  const surprise = () => {
    const index = surpriseIndex(titles.length, center);
    setSpinning(true);
    // A long run first, then the landing: the shelf spins past titles before it stops.
    const track = trackRef.current;
    const step = reduced ? flatDims : dims;
    if (track && !reduced) {
      const far = index > center ? titles.length - 1 : 0;
      track.scrollTo({ left: scrollFor(far, step), behavior: "smooth" });
      window.setTimeout(() => scrollToIndex(index), 260);
    } else {
      scrollToIndex(index);
    }
    window.setTimeout(() => setSpinning(false), 1100);
  };

  const { from, to } = mountedRange(windowAnchor(center), titles.length);
  const step = reduced ? flatDims : dims;

  return (
    <div className="para-ti-shelf" data-reduced={reduced || undefined} data-spinning={spinning || undefined}>
      <div
        ref={trackRef}
        role="list"
        aria-label={`${label}: ${titles.length} títulos`}
        className="para-ti-track"
        style={{ "--slot": `${step.slot}px`, "--depth": `${step.depth}px`, "--shelf-h": `${step.height}px` } as CSSProperties}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        data-shelf-track
      >
        {titles.map((title, index) => (
          <Slot
            key={title.catalogId}
            title={title}
            index={index}
            mounted={index >= from && index <= to}
            isCenter={index === center}
            near={Math.abs(index - center) <= 2}
            reduced={reduced}
            dims={dims}
            slotRefs={slotRefs}
            linkRefs={linkRefs}
            onItemClick={onItemClick}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="para-ti-center-row">
        {current ? <div className="min-w-0 flex-1">{renderCenter(current)}</div> : null}
        <button type="button" onClick={surprise} className={cn("para-ti-surprise", focusRing)} disabled={titles.length < 2}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="size-5">
            <rect x="4" y="4" width="16" height="16" rx="4" />
            <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none" />
          </svg>
          Sorpréndeme
        </button>
      </div>
    </div>
  );
};

const FlatPoster = ({ title }: { title: ParaTiTitle }) => (
  <span className="para-ti-flat">
    <PosterImage name={title.name} posterPath={title.posterPath} sizes="124px" className="rounded-poster" />
  </span>
);

type SlotProps = {
  title: ParaTiTitle;
  index: number;
  mounted: boolean;
  isCenter: boolean;
  near: boolean;
  reduced: boolean;
  dims: ShelfDims;
  slotRefs: React.RefObject<Map<string, HTMLElement>>;
  linkRefs: React.RefObject<Map<string, HTMLAnchorElement>>;
  onItemClick: (index: number, event: MouseEvent) => void;
};

/** One title's place on the shelf; re-renders only when its own state changes. */
const Slot = memo(function Slot({ title, index, mounted, isCenter, near, reduced, dims, slotRefs, linkRefs, onItemClick }: SlotProps) {
  return (
    <div
      role="listitem"
      className="para-ti-slot"
      data-index={index}
      data-center={isCenter || undefined}
      ref={(node) => {
        if (node && mounted) slotRefs.current.set(title.catalogId, node);
        else slotRefs.current.delete(title.catalogId);
      }}
    >
      {mounted ? (
        <div className="para-ti-box-wrap">
          <div data-mover className="para-ti-mover">
            <Link
              ref={(node) => {
                if (node) linkRefs.current.set(title.catalogId, node);
                else linkRefs.current.delete(title.catalogId);
              }}
              href={previewFichaHref(title.kind, title.tmdbId)}
              aria-label={`${title.name}${title.year ? ` (${title.year})` : ""}`}
              aria-current={isCenter ? "true" : undefined}
              tabIndex={isCenter ? 0 : -1}
              onClick={(event) => onItemClick(index, event)}
              className={cn("para-ti-item", focusRing)}
              data-ficha={title.catalogId}
              data-para-ti-item
            >
              {reduced ? <FlatPoster title={title} /> : <Box title={title} dims={dims} near={near} />}
            </Link>
          </div>
        </div>
      ) : (
        <span className="sr-only">{title.name}</span>
      )}
    </div>
  );
});

/**
 * A title as a box: its spine faces you, its cover is the side that turns out at the centre. Only
 * the boxes near the centre load their cover image; the others show the poster's colour there.
 */
const Box = ({ title, dims, near }: { title: ParaTiTitle; dims: ShelfDims; near: boolean }) => {
  const sliver = tmdbPosterUrl(title.posterPath, "w185");
  return (
    <span
      className="para-ti-box"
      style={{ "--ambient": title.posterAmbient ?? "38 44 52" } as CSSProperties}
      aria-hidden="true"
    >
      <span className="para-ti-face para-ti-spine" data-spine-face>
        {sliver ? <span className="para-ti-spine-sliver" style={{ backgroundImage: `url(${sliver})` }} /> : null}
        <span className="para-ti-spine-title">{spineLabel(title.name, dims)}</span>
        {title.kind === "SERIES" ? <span className="para-ti-spine-kind">Serie</span> : null}
      </span>
      <span className="para-ti-face para-ti-cover">
        {near ? (
          <PosterImage name={title.name} posterPath={title.posterPath} sizes={`${dims.depth}px`} className="para-ti-cover-img" />
        ) : null}
      </span>
    </span>
  );
};

