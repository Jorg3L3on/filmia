type ImdbBadgeProps = {
  rating?: number | null;
  compact?: boolean;
};

export const ImdbBadge = ({ rating, compact = false }: ImdbBadgeProps) => {
  if (rating == null) {
    return null;
  }

  const label = `IMDb ${rating.toFixed(1)}`;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1" title={`${label}/10`}>
        <span className="inline-flex h-4 items-center rounded-[2px] bg-[#f5c518] px-1 font-serif text-[9px] font-black tracking-tight text-black">
          IMDb
        </span>
        <span className="text-xs font-semibold text-[#f5c518]">{rating.toFixed(1)}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5" title={`${label}/10`}>
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
