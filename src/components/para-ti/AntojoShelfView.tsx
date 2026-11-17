"use client";

import { CenterCard } from "@/components/para-ti/CenterCard";
import { ParaTiShelf } from "@/components/para-ti/ParaTiShelf";
import type { AntojoId } from "@/lib/para-ti/antojos";
import type { ParaTiTitle } from "@/lib/para-ti/rank";
import { ROOMS } from "@/lib/para-ti/rooms";

/** An antojo's shelf with the centred title's card under it (FIL-I60-5). */
export const AntojoShelfView = ({
  titles,
  antojo,
  label,
  memoryKey,
}: {
  titles: ParaTiTitle[];
  antojo: AntojoId;
  label: string;
  memoryKey: string;
}) => (
  <ParaTiShelf
    titles={titles}
    label={label}
    memoryKey={memoryKey}
    lean={ROOMS[antojo].motion.lean}
    renderCenter={(title) => <CenterCard title={title} />}
  />
);
