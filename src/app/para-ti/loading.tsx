export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl" aria-busy="true" aria-label="Cargando Para ti">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-white/5" />
    </div>
  );
}
