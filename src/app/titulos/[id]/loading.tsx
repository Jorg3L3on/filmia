export default function TitleLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando ficha">
      <div className="relative -mx-4 -mt-6 sm:-mt-8">
        <div className="h-[min(62vw,360px)] min-h-[260px] shimmer sm:h-[400px] sm:rounded-b-3xl" />
        <div className="relative z-10 -mt-28 flex items-end gap-4 px-4 sm:-mt-32 sm:gap-6 sm:px-8">
          <div className="aspect-[2/3] w-[40vw] max-w-[188px] rounded-poster shimmer sm:w-56 sm:max-w-none" />
          <div className="min-w-0 flex-1 space-y-3 pb-1">
            <div className="h-3 w-24 rounded-full shimmer" />
            <div className="h-10 w-64 max-w-full rounded-xl shimmer" />
            <div className="h-4 w-40 rounded-full shimmer" />
          </div>
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
