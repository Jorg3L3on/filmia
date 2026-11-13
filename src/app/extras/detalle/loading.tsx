/** While the partida loads: the crop's shape, no image. */
export default function DetalleLoading() {
  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col gap-5" aria-busy="true" aria-label="Cargando Detalle">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-full bg-chrome" />
        <span className="h-9 flex-1 rounded-xl bg-chrome/70" />
      </div>
      <span className="mx-auto size-[15.625rem] rounded-[1.4rem] bg-chrome/60 motion-safe:animate-pulse" />
      <span className="h-12 rounded-2xl bg-chrome/50" />
    </div>
  );
}
