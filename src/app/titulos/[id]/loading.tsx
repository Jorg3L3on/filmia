export default function TitleLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando ficha">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
        <div className="aspect-[2/3] w-40 rounded-poster shimmer sm:w-52" />
        <div className="w-full space-y-3">
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
