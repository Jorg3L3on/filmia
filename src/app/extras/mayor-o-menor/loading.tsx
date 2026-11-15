/** While the partida loads: the stacked cards' shape (FIL-I56-6), no numbers. */
export default function MayorLoading() {
  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col" aria-busy="true" aria-label="Cargando Mayor o menor">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-full bg-chrome" />
        <span className="h-11 flex-1 rounded-xl bg-chrome/70" />
      </div>
      <span className="mt-2 h-6 rounded-full bg-chrome/40" />
      <div className="mayor-stack mt-2 flex flex-col gap-3">
        <span className="mayor-card rounded-[1.625rem] bg-chrome/50 motion-safe:animate-pulse" />
        <span className="mayor-card rounded-[1.625rem] bg-chrome/50 motion-safe:animate-pulse" />
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <span className="h-[3.875rem] rounded-[1.25rem] bg-chrome/50" />
        <span className="h-[3.875rem] rounded-[1.25rem] bg-chrome/50" />
      </div>
    </div>
  );
}
