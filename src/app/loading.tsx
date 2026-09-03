export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando">
      <div className="space-y-3">
        <div className="h-3 w-16 rounded-full bg-chrome/80" />
        <div className="h-10 w-48 rounded-sm bg-surface" />
        <div className="h-4 w-full max-w-md rounded-sm bg-well" />
      </div>
      <div className="rail -mx-4 flex gap-3 overflow-hidden px-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="aspect-[2/3] w-[108px] shrink-0 rounded-poster bg-well sm:w-[128px]"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-canvas-deep">
        <div className="grid grid-cols-7">
          {Array.from({ length: 21 }, (_, index) => (
            <div
              key={index}
              className="aspect-square border-b border-r border-line/80 bg-well/80"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
