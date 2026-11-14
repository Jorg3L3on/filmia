/** While the grid loads (the first open of the day reads three filmographies): its shape, no names. */
export default function CuadriculaLoading() {
  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col gap-4" aria-busy="true" aria-label="Cargando La cuadrícula">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-full bg-chrome" />
        <span className="h-9 flex-1 rounded-xl bg-chrome/70" />
      </div>
      <div className="grid grid-cols-[4.75rem_repeat(3,minmax(0,1fr))] gap-[0.4375rem]">
        {Array.from({ length: 16 }, (_, index) => (
          <span key={index} className={index < 4 || index % 4 === 0 ? "h-12" : "aspect-[2/3] rounded-xl bg-chrome/50 motion-safe:animate-pulse"} />
        ))}
      </div>
    </div>
  );
}
