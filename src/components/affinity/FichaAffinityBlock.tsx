import { FichaAffinity } from "@/components/affinity/FichaAffinity";
import type { FichaAffinity as FichaAffinityState } from "@/lib/affinity-store";

/** Streams the ficha's «Para ti» chip; nothing when there is nothing to say (watched, no data). */
export const FichaAffinityBlock = async ({
  promise,
  titleName,
}: {
  promise: Promise<FichaAffinityState | null>;
  titleName: string;
}) => {
  const state = await promise.catch(() => null);
  return state ? <FichaAffinity state={state} titleName={titleName} /> : null;
};
