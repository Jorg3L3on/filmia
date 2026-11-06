import "server-only";

/**
 * Óscar per person, server side (FIL-I43). Data: DLu/oscar_data (BSD-2-Clause), from the Academy
 * Awards Database; see `@/lib/oscars-core`. The JSON (~1.1 MB since FIL-I45-1 keeps every nomination) must never reach a client bundle,
 * hence `server-only`.
 */
import data from "@/data/oscars-by-person.json";
import { oscarsFor, type OscarIndex, type PersonOscarRecord } from "@/lib/oscars-core";

const INDEX = data as unknown as OscarIndex;

export const oscarDataSource = () => INDEX.source;

/** `nm…` → wins and lost nominations (newest first) and their count; null when the person has no Oscar nomination. */
export const oscarsForImdbId = (imdbId: string | null | undefined): PersonOscarRecord | null =>
  oscarsFor(INDEX, imdbId);
