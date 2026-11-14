/** While the partida loads: the board's shape, no numbers. */
export default function MayorLoading() {
  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col gap-4" aria-busy="true" aria-label="Cargando Mayor o menor">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-full bg-chrome" />
        <span className="h-9 flex-1 rounded-xl bg-chrome/70" />
      </div>
      <span className="h-10 rounded-xl bg-chrome/50" />
      <div className="grid grid-cols-2 gap-3.5">
        <span className="aspect-[2/3] rounded-2xl bg-chrome/60 motion-safe:animate-pulse" />
        <span className="aspect-[2/3] rounded-2xl bg-chrome/60 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
