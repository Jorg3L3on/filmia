import Link from "next/link";
import type { FichaView } from "@/components/watchlist/types";
import { cn } from "@/lib/cn";
import type { MarathonPick } from "@/lib/tonight/double-feature";
import { formatRuntimeShort } from "@/lib/tonight/time";
import { focusRing, glassRowClass } from "@/lib/ui";

/**
 * «Maratón que cabe en tu noche» (FIL-I46-3): two or three films of the current view that end,
 * together, before bedtime — with the total and the time it ends. Each opens its ficha.
 */
export const WatchlistMarathon = ({ pick }: { pick: MarathonPick<FichaView> }) => (
  <aside data-marathon aria-label="Maratón que cabe en tu noche" className={cn(glassRowClass, "watchlist-marathon space-y-2.5 px-4 py-4")}>
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Maratón que cabe en tu noche</p>
      <p className="shrink-0 text-xs tabular-nums text-fog">
        {formatRuntimeShort(pick.totalMinutes)} · acaba {pick.endsAt}
      </p>
    </div>
    <ol className="flex gap-2.5">
      {pick.items.map((ficha, index) => (
        <li key={ficha.id} className="min-w-0 flex-1">
          <Link href={`/titulos/${ficha.id}`} className={cn("press-scale flex min-w-0 items-center gap-2 rounded-xl bg-black/25 p-2", focusRing)}>
            <span aria-hidden="true" className="font-serif text-lg leading-none text-accent">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-paper">{ficha.name}</span>
              <span className="block text-[11px] text-mist">{formatRuntimeShort(ficha.runtimeMinutes)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  </aside>
);
