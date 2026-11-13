/** While the partida loads: the cast list's shape, no names. */
export default function RepartoLoading() {
  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col gap-3" aria-busy="true" aria-label="Cargando Reparto misterioso">
      <div className="flex items-center gap-3">
        <span className="size-11 rounded-full bg-chrome" />
        <span className="h-9 flex-1 rounded-xl bg-chrome/70" />
      </div>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <span key={index} className="h-[3.25rem] rounded-[0.875rem] bg-chrome/40 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
