import { formatRating } from "@/lib/labels";

type PersonalRatingProps = {
  rating?: number | null;
  size?: "sm" | "md";
};

export const PersonalRating = ({
  rating,
  size = "md",
}: PersonalRatingProps) => {
  const isEmpty = rating == null;

  return (
    <span
      className={
        size === "sm"
          ? "inline-flex items-baseline gap-1.5 text-xs"
          : "inline-flex items-baseline gap-2 text-sm"
      }
      title="Tu calificación personal"
    >
      <span className="text-[10px] uppercase tracking-wide text-fog">
        Tu calificación
      </span>
      <span className={isEmpty ? "text-mist" : "font-medium text-star"}>
        {formatRating(rating)}
      </span>
    </span>
  );
};
