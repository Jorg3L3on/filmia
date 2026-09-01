type ImdbBadgeProps = {
  rating?: number | null;
};

export const ImdbBadge = ({ rating }: ImdbBadgeProps) => {
  if (rating == null) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`IMDb ${rating.toFixed(1)}/10`}
    >
      <span className="inline-flex h-5 items-center rounded-[3px] bg-[#f5c518] px-1.5 font-serif text-[11px] font-black tracking-tight text-black">
        IMDb
      </span>
      <span className="text-sm font-semibold text-[#f5c518]">
        {rating.toFixed(1)}
        <span className="text-[11px] font-medium text-[#c9a227]">/10</span>
      </span>
    </span>
  );
};
