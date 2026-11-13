import { BackDisc } from "@/components/PageHeader";
import type { CeremonyInfo } from "@/lib/quinielas/hub-core";

const DAY_FORMAT = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });

/** «Abre con las nominaciones» (FIL-I51-2): a ceremony whose ballots are not open yet. */
export const QuinielaSoon = ({ ceremony, nominationsOn }: { ceremony: CeremonyInfo; nominationsOn: string }) => (
  <div className="flex flex-col gap-5" data-quiniela-soon>
    <div className="flex items-center gap-3">
      <BackDisc href="/extras/quinielas" label="Volver a las quinielas" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">De temporada</p>
        <h1 className="mt-1 font-serif text-[1.9rem] font-semibold leading-none text-paper">{ceremony.title}</h1>
      </div>
    </div>
    <div className="rounded-2xl border border-chrome bg-surface p-5">
      <h2 className="font-serif text-xl text-paper">Abre con las nominaciones</h2>
      <p className="mt-2 text-sm text-fog">
        Las nominadas salen el {DAY_FORMAT.format(new Date(`${nominationsOn}T12:00:00Z`))}. Ese día podrás elegir quién gana
        cada categoría, cambiar de opinión hasta que empiece la ceremonia y retar a tus amigos.
      </p>
    </div>
  </div>
);
