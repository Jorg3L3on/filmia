export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando diario">
      <div className="space-y-3">
        <div className="h-3 w-16 rounded-full shimmer" />
        <div className="h-10 w-48 rounded-xl shimmer" />
        <div className="h-4 w-full max-w-md rounded-xl shimmer" />
      </div>
      <div className="rail -mx-4 flex gap-4 overflow-hidden px-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="aspect-[2/3] w-[148px] shrink-0 rounded-poster shimmer sm:w-[196px]"
          />
        ))}
      </div>
    </div>
  );
}
