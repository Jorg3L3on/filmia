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
      title="Tu nota personal"
    >
      <span className="text-[10px] uppercase tracking-wide text-[#99aabb]">
        Tu nota
      </span>
      <span className={isEmpty ? "text-[#678]" : "font-medium text-[#ff8000]"}>
        {formatRating(rating)}
      </span>
    </span>
  );
};
