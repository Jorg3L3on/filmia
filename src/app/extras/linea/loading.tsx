/** While the partida loads: the line's shape, no films. */
export default function LineaLoading() {
  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col gap-4" aria-busy="true" aria-label="Cargando Línea de tiempo">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-full bg-chrome" />
        <span className="h-9 flex-1 rounded-xl bg-chrome/70" />
      </div>
      <span className="h-[6.5rem] rounded-[1.4rem] bg-chrome/60 motion-safe:animate-pulse" />
      {[0, 1, 2].map((index) => (
        <span key={index} className="h-14 rounded-xl bg-chrome/40" />
      ))}
    </div>
  );
}
