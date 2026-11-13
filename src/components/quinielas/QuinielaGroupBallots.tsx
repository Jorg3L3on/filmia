import { cn } from "@/lib/cn";
import type { GroupBallots } from "@/lib/quinielas/groups";
import type { BallotCategory } from "@/lib/quinielas/view";

const Mark = ({ hit }: { hit: boolean }) => (
  <span
    className={cn("grid size-4 shrink-0 place-items-center rounded-full text-ink", hit ? "bg-success" : "bg-danger")}
    role="img"
    aria-label={hit ? "acertó" : "falló"}
  >
    <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {hit ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
    </svg>
  </span>
);

/**
 * «Las boletas» (FIL-I51-13): how each member voted in every category. Being in the group means
 * sharing your ballot with it (Jorge), so it shows at any time; once a category has a winner, each
 * pick is marked as a hit or a miss.
 */
export const QuinielaGroupBallots = ({
  categories,
  group,
  winners,
}: {
  categories: BallotCategory[];
  group: GroupBallots;
  /** categoryId → winning nomineeId, for the categories announced so far. */
  winners: Readonly<Record<string, string>>;
}) => (
  <ol className="flex flex-col gap-2.5" aria-label="Las boletas del grupo" data-quiniela-group-ballots>
    {categories.map((category) => {
      const winnerId = winners[category.id];
      const winner = winnerId ? category.nominees.find((nominee) => nominee.id === winnerId) : null;
      return (
        <li key={category.id} className="rounded-2xl border border-chrome bg-surface p-3" data-ballot-category={category.id}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fog">{category.short}</h3>
            {winner ? <span className="truncate text-xs text-star">Ganó {winner.name}</span> : null}
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {group.members.map((member, index) => {
              const pickId = group.ballots[index]?.[category.id];
              const pick = pickId ? category.nominees.find((nominee) => nominee.id === pickId) : null;
              return (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span className={cn("w-16 shrink-0 truncate", member.isYou ? "font-semibold text-paper" : "text-fog")}>
                    {member.isYou ? "Tú" : member.name}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", pick ? "text-paper" : "text-faint")}>
                    {pick ? pick.name : "Sin voto"}
                  </span>
                  {winnerId && pick ? <Mark hit={pickId === winnerId} /> : null}
                </li>
              );
            })}
          </ul>
        </li>
      );
    })}
  </ol>
);
