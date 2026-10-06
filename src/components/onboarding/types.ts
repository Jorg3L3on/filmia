import type { Platform, TitleKind } from "@/db";

/** A title the flow touched (or found already in the library), client-side. */
export type FlowTitle = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName?: string | null;
  year: number | null;
  posterPath: string | null;
  /** Row id once saved; null while the save is in flight. */
  titleId: string | null;
  /** The flow inserted this row (so changing one's mind may delete it). */
  createdByFlow: boolean;
  platform?: Platform | null;
};

export const flowTitleKey = (title: Pick<FlowTitle, "tmdbId" | "kind">) => `${title.kind}:${title.tmdbId}`;
