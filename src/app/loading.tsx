export default function Loading() {
  return (
    <div
      className="mx-auto max-w-lg space-y-4 rounded-2xl border border-line bg-well p-6"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="shimmer h-3 w-24 rounded-full" />
      <div className="shimmer h-40 rounded-xl" />
      <div className="shimmer h-24 rounded-xl" />
      <div className="flex gap-3">
        <div className="shimmer h-10 flex-1 rounded-[var(--radius-button)]" />
        <div className="shimmer h-10 w-24 rounded-[var(--radius-button)]" />
      </div>
    </div>
  );
}
