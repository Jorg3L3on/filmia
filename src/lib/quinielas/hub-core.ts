/**
 * Quinielas de premios (FIL-I51-8): what the /extras/quinielas hub lists and what each ceremony's
 * screens call it. Pure and client-safe.
 */
import { AWARDS, nightTitle, quinielaTitle, type AwardId } from "@/lib/quinielas/awards";
import { ballotPhase, ceremonyWindow, type QuinielaCeremonyFile } from "@/lib/quinielas/ceremony-core";

/** Names a ceremony's screens use. */
export type CeremonyInfo = {
  id: string;
  award: AwardId;
  awardName: string;
  year: number;
  /** «Quiniela del Óscar 2027». */
  title: string;
  /** «La noche del Óscar». */
  night: string;
};

export const ceremonyInfo = (file: Pick<QuinielaCeremonyFile, "id" | "award" | "year">): CeremonyInfo => ({
  id: file.id,
  award: file.award,
  awardName: AWARDS[file.award].name,
  year: file.year,
  title: quinielaTitle(file.award, file.year),
  night: nightTitle(file.award),
});

export const ceremonyPath = (ceremonyId: string) => `/extras/quinielas/${ceremonyId}`;

export type HubState =
  /** The nominations are not out yet. */
  | "proxima"
  /** Nominations out, ballots not opened by the admin yet. */
  | "pronto"
  | "abierta"
  /** Closed, winners still coming in (or none yet). */
  | "en-vivo"
  /** Every winner in. */
  | "resultado";

export type HubEntry = {
  info: CeremonyInfo;
  state: HubState;
  nominationsOn: string;
  ceremonyOn: string;
  closesAt: Date | null;
  total: number;
  voted: number;
  announced: number;
};

const ORDER: Record<HubState, number> = { "en-vivo": 0, abierta: 1, pronto: 2, proxima: 3, resultado: 4 };

/**
 * The hub: every ceremony that is in season or still ahead, the live and open ones first. Two
 * ceremonies can be open at once (BAFTA and the Óscar in February). A ceremony leaves the hub a
 * week after it ends, with its window.
 */
export const hubEntries = (
  ceremonies: readonly QuinielaCeremonyFile[],
  input: {
    today: string;
    now: Date;
    closingTimes: Readonly<Record<string, Date>>;
    voteCounts: Readonly<Record<string, number>>;
    winnerCounts: Readonly<Record<string, number>>;
  },
): HubEntry[] =>
  ceremonies
    .filter((file) => input.today <= ceremonyWindow(file).to)
    .map((file) => {
      const closesAt = input.closingTimes[file.id] ?? null;
      const total = file.categories.length;
      const announced = Math.min(input.winnerCounts[file.id] ?? 0, total);
      const phase = ballotPhase({ hasCeremony: true, closesAt, now: input.now });
      const state: HubState =
        input.today < file.nominationsOn
          ? "proxima"
          : phase === "pronto"
            ? "pronto"
            : phase === "abierta"
              ? "abierta"
              : announced >= total
                ? "resultado"
                : "en-vivo";
      return {
        info: ceremonyInfo(file),
        state,
        nominationsOn: file.nominationsOn,
        ceremonyOn: file.ceremonyOn,
        closesAt,
        total,
        voted: Math.min(input.voteCounts[file.id] ?? 0, total),
        announced,
      };
    })
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.ceremonyOn.localeCompare(b.ceremonyOn));
