import { PosterRail } from "@/components/PosterRail";
import { ParaTiPoster } from "@/components/para-ti/ParaTiPoster";
import type { Shelf } from "@/lib/para-ti/shelves";

/** One ready shelf under the antojos: its title, how many, and a row of posters (FIL-I60-4). */
export const ParaTiShelfRow = ({ shelf }: { shelf: Shelf }) => (
  <section aria-labelledby={`estante-${shelf.id}`} className="para-ti-shelf-row" data-shelf={shelf.id}>
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={`estante-${shelf.id}`} className="min-w-0 truncate font-serif text-xl text-paper sm:text-2xl">
        {shelf.title}
      </h2>
      <span className="shrink-0 text-xs tabular-nums text-mist">{shelf.titles.length}</span>
    </div>
    <PosterRail ariaLabel={shelf.title}>
      {shelf.titles.map((title) => (
        <ParaTiPoster key={title.catalogId} title={title} className="w-[7.5rem] shrink-0 snap-start sm:w-36" />
      ))}
    </PosterRail>
  </section>
);
