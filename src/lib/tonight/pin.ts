import type { TonightEvent, TonightReason } from "@/lib/tonight/types";

/** «Esta noche» from Quiero ver: the newest pin of the last 18 h wins unless an «Ahora no» came later. */
export const PIN_WINDOW_MS = 18 * 60 * 60 * 1000;

export const PINNED_REASON: TonightReason = {
  kind: "pinned",
  text: "La elegiste para esta noche",
  weight: 1,
  personal: true,
};

/** The title pinned for tonight, or null when there is none, it expired, or «Ahora no» cancelled it. */
export const findPinnedTitleId = (events: readonly TonightEvent[], now: Date): string | null => {
  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const pin = sorted.find((event) => event.kind === "pinned");
  if (!pin || now.getTime() - pin.createdAt.getTime() > PIN_WINDOW_MS) {
    return null;
  }
  const cancelled = sorted.some(
    (event) =>
      event.titleId === pin.titleId &&
      event.kind === "not_tonight" &&
      event.createdAt.getTime() > pin.createdAt.getTime(),
  );
  return cancelled ? null : pin.titleId;
};
