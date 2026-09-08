import { Button } from "@/components/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-8 h-40 w-52" aria-hidden="true">
        <div className="absolute inset-x-8 top-2 h-28 rounded-sm border-4 border-paper/15 bg-well" />
        <div className="absolute bottom-3 left-6 rotate-[-12deg] rounded-sm bg-paper/90 px-2 py-1 text-[10px] font-bold text-ink">
          404
        </div>
        <div className="absolute right-8 bottom-2 rotate-[8deg] rounded-sm bg-accent/90 px-2 py-1 text-[10px] font-bold text-ink">
          FILMIA
        </div>
        <span className="absolute bottom-6 left-16 h-2 w-2 rounded-full bg-star" />
        <span className="absolute bottom-5 left-24 h-1.5 w-1.5 rounded-full bg-paper/70" />
        <span className="absolute right-16 bottom-7 h-2 w-2 rounded-full bg-star/80" />
      </div>
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
        Fuera de cartelera
      </p>
      <h1 className="mt-3 font-serif text-3xl text-paper">Página no encontrada</h1>
      <p className="mt-2 text-accent" aria-hidden="true">
        ✦
      </p>
      <p className="mt-3 text-sm leading-relaxed text-fog">
        Parece que esta escena se perdió en el corte final. Volvamos al guion principal.
      </p>
      <Button href="/" className="mt-8">
        ← Volver al Diario
      </Button>
    </div>
  );
}
