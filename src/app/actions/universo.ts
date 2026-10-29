"use server";

import { requireUserId } from "@/lib/session";
import {
  bridgeAfterWatch,
  loadUniversoPerson,
  type BridgeReveal,
  type UniversoPerson,
} from "@/lib/universo/store";

/** U3 · a person's sheet in «Tu universo». */
export const universoPerson = async (key: string): Promise<UniversoPerson | null> => {
  const userId = await requireUserId();
  if (typeof key !== "string" || !/^\d+(\+\d+)?$/.test(key)) {
    return null;
  }
  return loadUniversoPerson(userId, key).catch(() => null);
};

/** U4 · after «Vi esto»: the bridge the film just made, once per person. */
export const universoBridge = async (cardId: string): Promise<BridgeReveal | null> => {
  const userId = await requireUserId();
  if (typeof cardId !== "string" || cardId.length > 64) {
    return null;
  }
  return bridgeAfterWatch(userId, cardId).catch(() => null);
};
