"use client";

import Image from "next/image";
import { useState } from "react";
import { PersonSheet } from "@/components/universo/PersonSheet";
import { cn } from "@/lib/cn";
import { nodeProgress, ROLE_LABEL, type Island, type UniversoNode } from "@/lib/universo/core";
import { focusRing } from "@/lib/ui";

const profileUrl = (path: string) => `https://image.tmdb.org/t/p/w185${path}`;

const SIZE = (count: number) => (count >= 3 ? 64 : count === 2 ? 54 : 44);

/**
 * One person of the universe: size = films of yours, the ring = how close to complete («n de N»),
 * grey while it is one film with no known total. A tap opens their sheet (U3).
 */
const NodeBubble = ({ node, onOpen }: { node: UniversoNode; onOpen: (node: UniversoNode) => void }) => {
  const size = SIZE(node.count);
  const progress = nodeProgress(node);
  const ring =
    progress != null
      ? `conic-gradient(var(--accent) ${Math.round(progress * 360)}deg, rgb(255 255 255 / 0.14) 0)`
      : "rgb(255 255 255 / 0.14)";
  const label = node.total ? `${node.count} de ${node.total}` : node.count > 1 ? `${node.count}` : null;
  return (
    <li className="flex w-[4.5rem] flex-col items-center gap-1 text-center">
      <button
        type="button"
        onClick={() => onOpen(node)}
        aria-label={`${node.name}, ${ROLE_LABEL[node.role].toLowerCase()}${node.total ? `: ${node.count} de ${node.total}` : node.count > 1 ? `: ${node.count} películas tuyas` : ""}${node.bridge ? ", puente" : ""}`}
        className={cn("press-scale relative rounded-full p-[2px]", focusRing)}
        style={{ background: ring, width: size + 4, height: size + 4 }}
      >
        <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-chrome text-[13px] font-semibold text-paper/80">
          {node.profilePath ? (
            <Image src={profileUrl(node.profilePath)} alt="" width={size} height={size} unoptimized className="size-full object-cover" />
          ) : (
            node.name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0))
              .join("")
          )}
        </span>
        {node.bridge ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-affinity px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-ink" aria-hidden="true">
            Puente
          </span>
        ) : null}
      </button>
      <span className="line-clamp-2 text-[11px] leading-tight text-paper/90">{node.name}</span>
      {label ? <span className="text-[10px] text-fog">{label}</span> : null}
    </li>
  );
};

/** The islands as groups of people, the biggest first (U1, U2). No physics, no blur: phones first. */
export const UniversoMap = ({
  islands,
  hidden,
  compact = false,
}: {
  islands: Island[];
  hidden: number;
  compact?: boolean;
}) => {
  const [open, setOpen] = useState<UniversoNode | null>(null);
  return (
    <>
      <ul className="flex flex-col gap-3">
        {islands.map((island, index) => {
          const nodes = compact ? island.nodes.slice(0, 6) : island.nodes;
          const films = island.films.map((film) => film.name);
          return (
            <li key={island.key} className="rounded-3xl border border-line bg-surface/70 px-3 pb-3 pt-2.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fog">
                <span className="sr-only">Isla {index + 1}: </span>
                {films.slice(0, 2).join(" · ")}
                {films.length > 2 ? ` · +${films.length - 2}` : ""}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-1 gap-y-2.5">
                {nodes.map((node) => (
                  <NodeBubble key={node.key} node={node} onOpen={setOpen} />
                ))}
                {compact && island.nodes.length > nodes.length ? (
                  <li className="flex w-[4.5rem] items-center justify-center text-[12px] text-fog">+{island.nodes.length - nodes.length}</li>
                ) : null}
              </ul>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && !compact ? <p className="mt-2 text-[12px] text-fog">Y {hidden} personas más, de una película cada una.</p> : null}
      <PersonSheet node={open} onClose={() => setOpen(null)} />
    </>
  );
};
