import { PICKS_SAVE_LABEL, WATCHLIST_SAVE_LABEL } from "../src/lib/mark-seen";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = () => {
  assert(PICKS_SAVE_LABEL === "Guardar", "Qué ver sheet CTA is Guardar");
  assert(
    WATCHLIST_SAVE_LABEL === "Guardar y quitar de Quiero ver",
    "Watchlist sheet keeps the remove-from-queue CTA",
  );
  assert(
    !PICKS_SAVE_LABEL.includes("Quiero ver"),
    "Picks CTA must not mention Quiero ver",
  );
  console.log("✓ Mark-seen CTA labels");
};

run();
