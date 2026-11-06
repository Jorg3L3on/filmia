"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { useNavOrigin } from "@/components/NavOriginTracker";
import { cn } from "@/lib/cn";
import { dockSearch } from "@/lib/dock-search";
import { pathOf } from "@/lib/nav-origin";
import {
  PERSON_ROLE_LABEL,
  type FilmographyEntry,
  type PersonFilmography,
  type PersonRole,
} from "@/lib/person-filmography";
import { personLifeLine } from "@/lib/person-view";
import { tmdbPosterUrl, tmdbProfileUrl } from "@/lib/tmdb";
import { focusRing } from "@/lib/ui";

/**
 * The person view's hero, «Tu recorrido» v3 (FIL-I45-2): a tilted wall of the person's own posters,
 * their photo in a ring (gold once they won an Óscar), the life line, the name, the role menu and
 * three numbers without boxes. When the name scrolls away a 64 px glass bar takes its place.
 */

/** Round TMDB profile photo; no photo, no placeholder. */
export const PersonPhoto = ({
  profilePath,
  name,
  className,
  sizes,
}: {
  profilePath: string | null;
  name: string;
  className: string;
  sizes: string;
}) => {
  const src = tmdbProfileUrl(profilePath);
  if (!src) {
    return null;
  }
  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-well ring-1 ring-white/15 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.8)]",
        className,
      )}
    >
      <Image
        src={src}
        alt={`Foto de ${name}`}
        fill
        sizes={sizes}
        className="object-cover"
        unoptimized
      />
    </span>
  );
};

/** The wall holds at most this many posters (5 × 3), the best known first. */
export const WALL_POSTERS = 15;

/**
 * The best known first; a short filmography (Stahelski: 4) repeats around so the wall never leaves
 * a dark gap, shifted by two per row so the same poster never stacks on itself.
 */
export const wallPosters = (entries: readonly FilmographyEntry[]) => {
  const known = [...entries]
    .filter((entry) => entry.posterPath)
    .sort((a, b) => b.votes - a.votes);
  if (known.length >= WALL_POSTERS || known.length === 0) {
    return known.slice(0, WALL_POSTERS);
  }
  return Array.from({ length: WALL_POSTERS }, (_, index) => {
    const row = Math.floor(index / 5);
    return known[(index + row * 2) % known.length]!;
  });
};

/** The photo in its ring: accent → gold, all gold for an Óscar winner. */
const RingedPhoto = ({
  profilePath,
  name,
  gold,
  size,
}: {
  profilePath: string | null;
  name: string;
  gold: boolean;
  size: "hero" | "bar";
}) => {
  const src = tmdbProfileUrl(profilePath);
  if (!src) {
    return null;
  }
  return (
    <span
      className={cn(
        "relative block shrink-0 rounded-full",
        size === "hero"
          ? "size-[72px] p-[2.5px] shadow-[0_18px_40px_-12px_rgb(var(--accent-rgb)/0.6)] min-[360px]:size-[88px]"
          : "size-[34px] p-[1.5px]",
        gold
          ? "bg-linear-to-br from-[#f7d774] via-star to-[#a8812a]"
          : "bg-linear-to-br from-accent via-star to-accent-tint",
      )}
    >
      <span
        className={cn(
          "relative block size-full overflow-hidden rounded-full border-canvas bg-well",
          size === "hero" ? "border-[3px]" : "border-2",
        )}
      >
        <Image
          src={src}
          alt={size === "hero" ? `Foto de ${name}` : ""}
          fill
          sizes={size === "hero" ? "88px" : "34px"}
          className="object-cover"
          unoptimized
        />
      </span>
    </span>
  );
};

/** Film grain over the hero: an SVG noise, soft-light, 10 %. */
const Grain = () => (
  <svg
    className="pointer-events-none absolute inset-0 size-full opacity-10 mix-blend-soft-light [mask-image:linear-gradient(to_bottom,#000_70%,transparent_98%)]"
    aria-hidden="true"
  >
    <filter id="persona-grain">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.9"
        numOctaves={2}
        stitchTiles="stitch"
      />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#persona-grain)" />
  </svg>
);

/** The tilted wall of posters; the rows blur-fade in one after the other. */
const PosterWall = ({ entries }: { entries: FilmographyEntry[] }) => {
  const wallRef = useRef<HTMLDivElement>(null);
  // Parallax: the wall drifts at 0.6× the scroll while the hero is on screen.
  useEffect(() => {
    const node = wallRef.current;
    if (
      !node ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 600);
        node.style.setProperty("--wall-drift", `${y * 0.4}px`);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (entries.length === 0) {
    return null;
  }
  return (
    <div ref={wallRef} className="persona-wall" aria-hidden="true">
      {entries.map((entry, index) => {
        const src = tmdbPosterUrl(entry.posterPath, "w185");
        return (
          <span
            key={`${entry.kind}:${entry.tmdbId}:${index}`}
            className="persona-wall-tile"
            style={{ ["--row" as string]: Math.floor(index / 5) }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element -- decorative TMDB w185 tiles, lazy, no optimizer round trip
              <img
                src={src}
                alt=""
                loading={index < 5 ? "eager" : "lazy"}
                decoding="async"
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
};

export type HeroStat = { value: string; label: string; tone?: "gold" };

export const PersonHero = ({
  name,
  profilePath,
  role,
  data,
  stats,
  gold,
  nameRef,
  roleMenu,
  nav,
}: {
  nav?: React.ReactNode;
  name: string;
  profilePath: string | null;
  role: PersonRole;
  data: PersonFilmography | null;
  stats: HeroStat[];
  /** The person won an Óscar: the ring turns gold. */
  gold: boolean;
  /** The name, watched by the sticky bar. */
  nameRef: RefObject<HTMLHeadingElement | null>;
  roleMenu: React.ReactNode;
}) => {
  const wall = data ? wallPosters([...data.entries, ...data.upcoming]) : [];
  const life = data ? personLifeLine(data.person) : null;
  const eyebrow = [PERSON_ROLE_LABEL[role], life].filter(Boolean).join(" · ");
  const long = name.length > 18;
  return (
    <section aria-label={name || "Persona"} className="space-y-0">
      <div
        className={cn(
          // Phones: the hero starts at the top of the screen, under the floating header (FIL-I45).
          "persona-hero relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-[28px]",
          wall.length > 0
            ? "pt-[calc(env(safe-area-inset-top)+250px)] min-[360px]:pt-[calc(env(safe-area-inset-top)+300px)] sm:pt-[224px]"
            : "pt-[calc(env(safe-area-inset-top)+128px)] sm:pt-16",
        )}
      >
        <PosterWall entries={wall} />
        {/* Canvas fade, then the accent glow low left and a lilac one top right. */}
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-canvas/55 via-canvas/45 via-35% to-canvas to-72%"
          aria-hidden="true"
        />
        <div
          className="persona-glow pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        {wall.length > 0 ? <Grain /> : null}
        {/* The header's own glass is off over the wall: this scrim keeps «Filmia» readable. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b from-canvas/80 to-transparent sm:hidden"
          aria-hidden="true"
        />
        {nav ? (
          <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 px-4 sm:top-4">
            {nav}
          </div>
        ) : null}
        <div className="relative space-y-3 px-4 pb-1">
          <RingedPhoto
            profilePath={profilePath}
            name={name}
            gold={gold}
            size="hero"
          />
          <div>
            <p className="text-[10.5px] font-medium tracking-[0.22em] text-accent-hover uppercase">
              {eyebrow}
            </p>
            <h2
              ref={nameRef}
              className={cn(
                "persona-name mt-1 line-clamp-2 pb-[0.12em] font-serif font-semibold text-pretty break-words",
                long
                  ? "text-[36px] leading-[1] tracking-[-0.02em] min-[360px]:text-[44px]"
                  : "text-[40px] leading-[1] tracking-[-0.03em] min-[360px]:text-[54px]",
              )}
            >
              {name || "…"}
            </h2>
          </div>
          {roleMenu}
        </div>
      </div>
      {stats.length > 0 ? (
        <dl className="mt-4 grid grid-flow-col auto-cols-fr border-y border-white/8 py-3.5">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                "min-w-0",
                index > 0 && "border-l border-white/8 pl-3",
                index < stats.length - 1 && "pr-2",
              )}
            >
              <dd
                className={cn(
                  "flex items-center gap-1.5 font-serif text-[26px] leading-none tracking-[-0.02em] min-[360px]:text-[30px]",
                  stat.tone === "gold" ? "text-star" : "text-paper",
                )}
              >
                {stat.tone === "gold" ? <LaurelGlyph /> : null}
                <span className="persona-tick">{stat.value}</span>
              </dd>
              <dt className="mt-1.5 text-[10px] font-medium tracking-[0.14em] text-fog uppercase">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
};

const LaurelGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0 drop-shadow-[0_0_8px_rgb(240_193_74/0.6)]"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 20V9M7 20c-3-2-4-6-3-10 2 1 3 4 3 10ZM17 20c3-2 4-6 3-10-2 1-3 4-3 10Z" />
  </svg>
);

/** True once the element has scrolled out above the top edge (minus `offset` px of header). */
export const useScrolledPast = (
  ref: RefObject<HTMLElement | null>,
  offset: number,
) => {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setPast(
            !entry.isIntersecting && entry.boundingClientRect.top < offset,
          );
        }
      },
      { rootMargin: `-${offset}px 0px 0px 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, offset]);
  return past;
};

/**
 * The 64 px glass bar under the site header once the name is gone: photo, name, «Rol · N de M
 * vistas» and the role menu. Hidden (and inert) until then.
 */
export const PersonStickyBar = ({
  visible,
  name,
  profilePath,
  gold,
  line,
  roleMenu,
  back,
}: {
  back?: React.ReactNode;
  visible: boolean;
  name: string;
  profilePath: string | null;
  gold: boolean;
  line: React.ReactNode;
  roleMenu: React.ReactNode;
}) => (
  <div
    data-persona-bar={visible ? "on" : "off"}
    aria-hidden={!visible}
    inert={!visible}
    className={cn(
      "persona-bar fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-b border-white/8 bg-canvas/72 shadow-[0_10px_30px_-16px_rgb(0_0_0/0.9)] backdrop-blur-xl backdrop-saturate-150 sm:top-[calc(7.5rem+env(safe-area-inset-top))]",
      visible ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
    )}
  >
    <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-2.5 px-4 lg:max-w-4xl">
      {back}
      <RingedPhoto
        profilePath={profilePath}
        name={name}
        gold={gold}
        size="bar"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[17px] leading-tight text-paper">
          {name}
        </p>
        <p className="truncate text-[11px] text-fog">{line}</p>
      </div>
      {roleMenu}
    </div>
  </div>
);

export const watchedLine = (
  role: PersonRole,
  watched: number,
  total: number,
) => (
  <>
    {PERSON_ROLE_LABEL[role]}
    {total > 0 ? (
      <>
        {" · "}
        <span className="text-success">
          {watched} de {total}
        </span>{" "}
        vistas
      </>
    ) : null}
  </>
);

const ChevronLeft = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const navDiscClass =
  "press-scale flex size-11 shrink-0 items-center justify-center rounded-full border border-white/16 bg-canvas/40 text-paper shadow-[0_10px_30px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl backdrop-saturate-150";

/** «Volver a · John Wick»: a glass disc and the destination in two quiet lines over the wall. */
const BackTo = ({
  label,
  eyebrow = "Volver a",
  children,
  compact = false,
}: {
  label: string;
  eyebrow?: string;
  children: React.ReactNode;
  compact?: boolean;
}) => (
  <span className="flex min-w-0 items-center gap-2.5">
    {children}
    {compact ? null : (
      <span
        className="min-w-0 text-left leading-tight [text-shadow:0_1px_12px_rgb(0_0_0/0.8)]"
        aria-hidden="true"
      >
        <span className="block text-[9.5px] font-medium tracking-[0.22em] text-paper/70 uppercase">
          {eyebrow}
        </span>
        <span className="block truncate font-serif text-[15px] text-paper">
          {label}
        </span>
      </span>
    )}
  </span>
);

/**
 * The person view's own navigation, over the poster wall (FIL-I45): «atrás» to the results it came
 * from, or to the page that opened it, and a search disc. On phones it replaces Buscar's top field.
 */
export const PersonTopNav = ({
  results,
  onBackToResults,
  compact = false,
}: {
  /** The search behind this person («Resultados de "x"»), when there is one. */
  results: string | null;
  onBackToResults: () => void;
  /** The sticky bar's copy: the back disc alone, smaller. */
  compact?: boolean;
}) => {
  const router = useRouter();
  const { origin, label, action } = useNavOrigin();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const showOrigin =
    !results && hydrated && origin && pathOf(origin.href) !== "/buscar";

  return (
    <div className="flex items-center justify-between gap-3">
      {results ? (
        <button
          type="button"
          onClick={onBackToResults}
          aria-label={`Volver a ${results}`}
          className={cn(
            "flex min-w-0 items-center rounded-full",
            !compact && "pr-2",
            focusRing,
          )}
        >
          <BackTo
            // «Resultados de «ridley scott»» reads as «Volver a la búsqueda · «ridley scott»».
            label={results.replace(/^Resultados de\s+/, "")}
            eyebrow={/^Resultados de\s/.test(results) ? "Volver a la búsqueda" : "Volver a"}
            compact={compact}
          >
            <span className={navDiscClass}>
              <ChevronLeft />
            </span>
          </BackTo>
        </button>
      ) : showOrigin ? (
        <Link
          href={origin.href}
          prefetch={false}
          aria-label={`Volver a ${label}`}
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.button !== 0
            ) {
              return;
            }
            event.preventDefault();
            const next = action();
            if (next.kind === "back") {
              router.back();
            } else {
              router.push(next.href);
            }
          }}
          className={cn(
            "flex min-w-0 items-center rounded-full pr-2",
            focusRing,
          )}
        >
          <BackTo label={label} compact={compact}>
            <span className={navDiscClass}>
              <ChevronLeft />
            </span>
          </BackTo>
        </Link>
      ) : compact ? null : (
        <span />
      )}
      {compact ? null : (
        <Link
          href="/buscar"
          aria-label="Buscar"
          onClick={() => dockSearch.requestFocus()}
          className={cn(navDiscClass, focusRing)}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.8-3.8" />
          </svg>
        </Link>
      )}
    </div>
  );
};

const noopSubscribe = () => () => {};
