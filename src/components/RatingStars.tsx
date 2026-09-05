"use client";

import { useSpringFeedback } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { formatStarScore } from "@/lib/labels";
import { focusRing } from "@/lib/ui";

type RatingStarsProps = {
  value: number | null;
  onChange: (rating: number) => void;
  size?: "md" | "lg";
  showValue?: boolean;
};

const STEPS = [1, 2, 3, 4, 5] as const;

export const RatingStars = ({
  value,
  onChange,
  size = "lg",
  showValue = true,
}: RatingStarsProps) => {
  const spring = useSpringFeedback();
  const starSize = size === "lg" ? "h-12 w-12" : "h-8 w-8";

  const handlePick = (rating: number) => {
    spring.trigger();
    onChange(rating);
  };

  return (
    <div className="space-y-3 text-center">
      <div
        role="group"
        aria-label="Tu nota, de media estrella a cinco"
        className={cn("flex justify-center gap-1.5", spring.className)}
      >
        {STEPS.map((star) => {
          const fullValue = star * 2;
          const halfValue = fullValue - 1;
          const fill =
            value == null
              ? "empty"
              : value >= fullValue
                ? "full"
                : value >= halfValue
                  ? "half"
                  : "empty";

          return (
            <span key={star} className="relative inline-flex">
              <StarShape fill={fill} className={starSize} gradientId={`star-half-${star}`} />
              <button
                type="button"
                aria-label={`${star - 0.5} estrellas`}
                aria-pressed={value === halfValue}
                onClick={() => handlePick(halfValue)}
                className={cn(
                  "absolute inset-y-0 left-0 w-1/2",
                  focusRing,
                )}
              />
              <button
                type="button"
                aria-label={`${star} estrellas`}
                aria-pressed={value === fullValue}
                onClick={() => handlePick(fullValue)}
                className={cn(
                  "absolute inset-y-0 right-0 w-1/2",
                  focusRing,
                )}
              />
            </span>
          );
        })}
      </div>
      {showValue ? (
        <p
          className="font-serif text-5xl tracking-tight text-star"
          aria-live="polite"
        >
          {formatStarScore(value)}
        </p>
      ) : null}
    </div>
  );
};

const StarShape = ({
  fill,
  className,
  gradientId,
}: {
  fill: "empty" | "half" | "full";
  className?: string;
  gradientId: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={cn("text-star drop-shadow-[0_0_10px_rgba(240,193,74,0.35)]", className)}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
        <stop offset="50%" stopColor="currentColor" />
        <stop offset="50%" stopColor="transparent" />
      </linearGradient>
    </defs>
    <path
      d="m12 3.6 2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.58 7.3 18.05l.9-5.23-3.8-3.7 5.25-.76Z"
      fill={
        fill === "full"
          ? "currentColor"
          : fill === "half"
            ? `url(#${gradientId})`
            : "none"
      }
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  </svg>
);
