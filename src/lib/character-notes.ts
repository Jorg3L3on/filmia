/**
 * TMDB writes its credit notes in English: «Tadeo Jones (voice)», «Guard (uncredited)». Filmia
 * shows them in Spanish (FIL-I44-14). Only the notes in parentheses change; names stay as they are.
 */
const NOTES: ReadonlyArray<[RegExp, string]> = [
  [/\(singing voice\)/gi, "(voz cantada)"],
  [/\(voice\)/gi, "(voz)"],
  [/\(uncredited\)/gi, "(sin acreditar)"],
  [/\(archive footage\)/gi, "(material de archivo)"],
  [/\(archival footage\)/gi, "(material de archivo)"],
  [/\(archive sound\)/gi, "(audio de archivo)"],
  [/\(credit only\)/gi, "(solo en créditos)"],
  [/\(cameo\)/gi, "(cameo)"],
];

export const characterInSpanish = (character: string) =>
  NOTES.reduce((text, [pattern, spanish]) => text.replace(pattern, spanish), character);
