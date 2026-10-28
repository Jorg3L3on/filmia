/**
 * TMDB person avatar logic (FIL-31): what `PersonAvatar` draws for a
 * person — the TMDB photo, or a two-letter monogram on a tint that stays the
 * same for the same person id. Never a silhouette.
 */

/** Monogram tints: id mod 6 (afinidad, reco, acento, rosa, azul, ámbar). */
export const AVATAR_TINTS = [
  "201 178 255", // --affinity
  "143 217 205", // --reco
  "255 122 69", // --accent
  "255 79 158", // --cine
  "122 168 255", // azul
  "240 193 74", // --star (ámbar)
] as const;

/** Stable tint (an «r g b» triplet) per person id; negative ids are folded in. */
export const avatarTint = (personId: number): string => {
  const n = Math.abs(Math.trunc(personId)) || 0;
  return AVATAR_TINTS[n % AVATAR_TINTS.length]!;
};

/**
 * Two initials: first and last word («Lucía Ferreyra» → «LF»), one for a
 * single word («Zendaya» → «Z»). Works on non-Latin names: takes the first
 * grapheme of each word, upper-cased where the script has case.
 */
export const avatarInitials = (name: string): string => {
  const words = name.trim().split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) {
    return "?";
  }
  const first = firstLetter(words[0]!);
  if (words.length === 1) {
    return first;
  }
  return first + firstLetter(words[words.length - 1]!);
};

const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

const firstLetter = (word: string): string => {
  const letters = word.replace(/^[^\p{L}\p{N}]+/u, "");
  const grapheme = segmenter ? (segmenter.segment(letters)[Symbol.iterator]().next().value?.segment ?? "") : Array.from(letters)[0] ?? "";
  return grapheme.toLocaleUpperCase("es-MX");
};

export type AvatarView =
  | { kind: "photo"; src: string }
  | { kind: "monogram"; initials: string; tint: string };

/** Photo when TMDB has one and it has not failed to load; otherwise the monogram. */
export const avatarView = ({
  personId,
  name,
  profilePath,
  failed = false,
}: {
  personId: number;
  name: string;
  profilePath: string | null | undefined;
  failed?: boolean;
}): AvatarView => {
  const src = failed || !profilePath ? null : `https://image.tmdb.org/t/p/w185${profilePath}`;
  if (src) {
    return { kind: "photo", src };
  }
  return { kind: "monogram", initials: avatarInitials(name), tint: avatarTint(personId) };
};
