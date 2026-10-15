import { useId } from "react";
import { cn } from "@/lib/cn";
import { STAR_PATH, starFills } from "@/lib/share-card";

/** Read-only half-star row for the public share page (FIL-I15-4). */
export const ShareStars = ({ rating, className }: { rating: number | null; className?: string }) => {
  const id = useId();
  const fills = starFills(rating);
  if (fills.length === 0) {
    return null;
  }
  return (
    <span className={cn("inline-flex gap-1 text-star", className)} aria-hidden="true">
      {fills.map((fill, index) => (
        <svg key={index} viewBox="0 0 24 24" className="size-7">
          <defs>
            <clipPath id={`${id}-${index}`}>
              <rect x="0" y="0" width={24 * fill} height="24" />
            </clipPath>
          </defs>
          <path d={STAR_PATH} fill="currentColor" opacity="0.22" />
          <path d={STAR_PATH} fill="currentColor" clipPath={`url(#${id}-${index})`} />
        </svg>
      ))}
    </span>
  );
};
