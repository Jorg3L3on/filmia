export default function TitleLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando ficha">
      <div className="flex items-end gap-4 sm:gap-6">
        <div className="aspect-[2/3] w-[38vw] max-w-[176px] rounded-poster shimmer sm:w-52 sm:max-w-none" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-3 w-24 rounded-full shimmer" />
          <div className="h-10 w-64 max-w-full rounded-xl shimmer" />
          <div className="h-4 w-40 rounded-full shimmer" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-16 rounded-2xl shimmer" />
        ))}
      </div>
    </div>
  );
}
