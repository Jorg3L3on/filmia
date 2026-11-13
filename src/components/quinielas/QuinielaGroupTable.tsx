import { cn } from "@/lib/cn";
import type { GroupStanding } from "@/lib/quinielas/groups";

/**
 * «Tu grupo» (FIL-I51-3): first names and hits; before any winner, how far each ballot is. Never an
 * email; the picks themselves are in «Las boletas» (FIL-I51-13).
 */
export const QuinielaGroupTable = ({
  standings,
  total,
  announced,
}: {
  standings: GroupStanding[];
  total: number;
  announced: number;
}) => {
  const max = Math.max(1, announced);
  return (
    <ol className="flex flex-col gap-1" aria-label="Tu grupo" data-quiniela-group-table>
      {standings.map((member, index) => {
        const value = announced > 0 ? member.hits : member.voted;
        const of = announced > 0 ? max : total;
        return (
          <li key={index} className="flex min-h-9 items-center gap-2.5 text-sm">
            <span className={cn("w-20 truncate", member.isYou ? "font-semibold text-paper" : "text-fog")}>
              {member.isYou ? "Tú" : member.name}
              {member.isOwner && !member.isYou ? <span className="sr-only"> (creó el grupo)</span> : null}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-well" aria-hidden="true">
              <span
                className={cn("block h-full rounded-full", member.isYou ? "bg-star" : "bg-fog")}
                style={{ width: `${(value / of) * 100}%` }}
              />
            </span>
            <span className={cn("w-20 text-right tabular-nums", member.isYou ? "text-paper" : "text-fog")}>
              {announced > 0 ? `${member.hits} ${member.hits === 1 ? "acierto" : "aciertos"}` : `${member.voted} de ${total}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
