import { readFileSync } from "node:fs";
import path from "node:path";
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
    // FIL-I21-8: stars and Guardar first; Fecha, Dónde la vi and Nota folded under «Más detalles».
  const sheet = readFileSync(path.join(process.cwd(), "src/components/MarkWatchedSheet.tsx"), "utf8");
  assert(sheet.includes("Más detalles") && sheet.includes("detailsOpen") && sheet.indexOf("<RatingStars") < sheet.indexOf("<span>Más detalles</span>") && sheet.indexOf("{saveLabel}") < sheet.indexOf("<span>Más detalles</span>"), "Vi esto: stars and Guardar above the folded details");
  assert(sheet.includes('Boolean((review ?? "").trim()) || (hasInitialDate && initialWatchedAt !== todayDateInput())'), "«Más detalles» opens by default with a note or a date that is not today");
console.log("✓ Mark-seen CTA labels");
};

run();
