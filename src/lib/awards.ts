/**
 * OMDb "Awards" sentences → a short Spanish chip for Quiero ver.
 *
 * Shapes seen in the wild:
 *   "Won 4 Oscars. 20 wins & 24 nominations total"
 *   "Nominated for 2 Oscars. 12 wins & 19 nominations total"
 *   "Won 1 Primetime Emmy. 3 wins & 10 nominations total"
 *   "Nominated for 3 BAFTA Film Awards. 1 win & 7 nominations total"
 *   "5 wins & 2 nominations"            (no major award)
 *   "N/A"
 */

export type AwardMajor = "oscar" | "emmy" | "globe" | "bafta";

export type AwardSummary = {
  major: AwardMajor | null;
  /** Major awards won (0 when the head says "Nominated for"). */
  majorWon: number;
  /** Major award nominations (0 when the head says "Won"). */
  majorNominated: number;
  wins: number;
  nominations: number;
};

const HEAD =
  /^(won|nominated for) (\d+) (oscar|primetime emmy|golden globe|bafta(?: film| tv)? award)s?\b/i;
const WINS = /(\d+) wins?\b/i;
const NOMINATIONS = /(\d+) nominations?\b/i;

const majorOf = (label: string): AwardMajor => {
  const lower = label.toLowerCase();
  if (lower.startsWith("oscar")) return "oscar";
  if (lower.startsWith("primetime emmy")) return "emmy";
  if (lower.startsWith("golden globe")) return "globe";
  return "bafta";
};

export const parseOmdbAwards = (raw: string | null | undefined): AwardSummary | null => {
  const text = raw?.trim() ?? "";
  if (!text || text === "N/A") {
    return null;
  }

  const head = HEAD.exec(text);
  const count = head ? Number(head[2]) : 0;
  const won = head?.[1].toLowerCase() === "won";
  const wins = Number(WINS.exec(text)?.[1] ?? 0);
  const nominations = Number(NOMINATIONS.exec(text)?.[1] ?? 0);

  if (!head && wins === 0 && nominations === 0) {
    return null;
  }

  return {
    major: head ? majorOf(head[3]) : null,
    majorWon: head && won ? count : 0,
    majorNominated: head && !won ? count : 0,
    wins,
    nominations,
  };
};

const plural = (count: number, singular: string, pluralForm: string) =>
  count === 1 ? singular : pluralForm;

/** Generic "N premios" only when there is enough to brag about. */
const MIN_GENERIC_WINS = 3;

/** One short label for the gold chip, or null when nothing is worth showing. */
export const awardChipLabel = (raw: string | null | undefined): string | null => {
  const summary = parseOmdbAwards(raw);
  if (!summary) {
    return null;
  }

  const { major, majorWon, majorNominated, wins } = summary;
  if (major && majorWon > 0) {
    switch (major) {
      case "oscar":
        return `${majorWon} Óscar`;
      case "emmy":
        return `${majorWon} Emmy`;
      case "globe":
        return majorWon === 1 ? "Globo de Oro" : `${majorWon} Globos de Oro`;
      case "bafta":
        return `${majorWon} BAFTA`;
    }
  }

  if (major && majorNominated > 0) {
    const name =
      major === "oscar"
        ? "Óscar"
        : major === "emmy"
          ? "Emmy"
          : major === "globe"
            ? "Globo de Oro"
            : "BAFTA";
    return majorNominated === 1
      ? `Nominada al ${name}`
      : `${majorNominated} nom. al ${name}`;
  }

  if (wins >= MIN_GENERIC_WINS) {
    return `${wins} ${plural(wins, "premio", "premios")}`;
  }

  return null;
};
