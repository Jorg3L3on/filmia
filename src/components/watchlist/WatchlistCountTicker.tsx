type WatchlistCountTickerProps = {
  count: number;
  className?: string;
};

const DIGITS = Array.from({ length: 10 }, (_, digit) => digit);

/** «259 títulos» whose digits roll when a filter changes the count. */
export const WatchlistCountTicker = ({ count, className }: WatchlistCountTickerProps) => {
  const digits = String(Math.max(0, count)).split("");
  return (
    <span className={className}>
      <span className="sr-only">{count}</span>
      <span className="num-ticker" aria-hidden="true">
        {digits.map((digit, index) => (
          <span
            key={`${digits.length}-${index}`}
            className="num-ticker-col"
            style={{ transform: `translateY(-${Number(digit)}em)` }}
          >
            {DIGITS.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </span>
        ))}
      </span>{" "}
      {count === 1 ? "título" : "títulos"}
    </span>
  );
};
