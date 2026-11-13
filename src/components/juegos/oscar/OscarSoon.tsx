import { BackDisc } from "@/components/PageHeader";

/** «Abre con las nominaciones» (FIL-I51-2): the season has no ballot yet. */
export const OscarSoon = ({ year }: { year: number }) => (
  <div className="flex flex-col gap-5" data-quiniela-soon>
    <div className="flex items-center gap-3">
      <BackDisc href="/juegos" label="Volver a Juegos" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">De temporada</p>
        <h1 className="mt-1 font-serif text-[1.9rem] font-semibold leading-none text-paper">Quiniela del Óscar {year}</h1>
      </div>
    </div>
    <div className="rounded-2xl border border-chrome bg-surface p-5">
      <h2 className="font-serif text-xl text-paper">Abre con las nominaciones</h2>
      <p className="mt-2 text-sm text-fog">
        En enero salen las nominadas. Ese día podrás elegir quién gana cada categoría, cambiar de opinión hasta que
        empiece la ceremonia y retar a tus amigos.
      </p>
    </div>
  </div>
);
