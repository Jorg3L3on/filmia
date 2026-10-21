"use client";

import { cn } from "@/lib/cn";
import type { NightLine } from "@/lib/tonight/night-line";

type TonightNightLineProps = {
  line: NightLine;
  className?: string;
};

/**
 * «Línea de la noche» (FIL-I21-5): a 2 px track under the chips that draws when the film
 * ends against bedtime. Only drawn when it informs: it fits, overflows by 30 min at most,
 * or bedtime already passed. The accent fill scales in X (transform only); the amber tail
 * and the dimmed state are opacity. role="img" with the sentence as its label.
 */
export const TonightNightLine = ({ line, className }: TonightNightLineProps) => {
  if (line.state === "none" || line.state === "over-long") {
    return null;
  }

  if (line.state === "past") {
    return (
      <div role="img" aria-label={line.label} className={cn("night-line is-past", className)}>
        <span className="night-line-track" aria-hidden="true">
          <span className="night-line-moon" style={{ left: 0 }}>
            <MoonIcon />
          </span>
          <span className="night-line-dot is-amber" style={{ left: "14%" }} />
          <span className="night-line-tail" style={{ left: "14%", width: "60%" }} />
        </span>
        <span className="night-line-labels" aria-hidden="true">
          <span className="night-line-label" style={{ left: 0 }}>
            {line.bedtimeAt}
          </span>
          <span className="night-line-label is-amber" style={{ left: "14%" }}>
            ya pasó tu hora · acabaría {line.endsAt}
          </span>
        </span>
      </div>
    );
  }

  const fits = line.state === "fits";
  // fits: bedtime at the right edge, the film ends at endRatio; over: the film ends at the
  // right edge, bedtime at bedtimeRatio and the tail past it is amber.
  const endPct = fits ? line.endRatio * 100 : 100;
  const bedtimePct = fits ? 100 : line.bedtimeRatio * 100;
  const accentPct = fits ? endPct : bedtimePct;

  return (
    <div role="img" aria-label={line.label} className={cn("night-line", !fits && "is-over", className)}>
      <span className="night-line-track" aria-hidden="true">
        <span className="night-line-fill" style={{ transform: `scaleX(${accentPct / 100})` }} />
        {!fits ? (
          <span className="night-line-tail" style={{ left: `${bedtimePct}%`, width: `${100 - bedtimePct}%` }} />
        ) : null}
        <span className="night-line-dot" style={{ left: 0 }} />
        <span className={cn("night-line-mark", !fits && "is-amber")} style={{ left: `${endPct}%` }} />
        <span className="night-line-moon" style={{ left: `${bedtimePct}%` }}>
          <MoonIcon />
        </span>
      </span>
      <span className="night-line-labels" aria-hidden="true">
        <span className="night-line-label" style={{ left: 0 }}>
          {line.startsAt}
        </span>
        {fits ? (
          <>
            <span className="night-line-label is-strong" style={{ left: `${endPct}%`, transform: "translateX(-50%)" }}>
              {line.episode ? "un capítulo acaba" : "acaba"} {line.endsAt}
            </span>
            <span className="night-line-label" style={{ right: 0 }}>
              {line.bedtimeAt}
            </span>
          </>
        ) : (
          <>
            {/* The moon already marks bedtime; its label only when it has room before «se pasa». */}
            {bedtimePct <= 70 ? (
              <span className="night-line-label" style={{ left: `${bedtimePct}%`, transform: "translateX(-50%)" }}>
                {line.bedtimeAt}
              </span>
            ) : null}
            <span className="night-line-label is-amber is-strong" style={{ right: 0 }}>
              se pasa {line.overflowMinutes} min
            </span>
          </>
        )}
      </span>
    </div>
  );
};

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);
