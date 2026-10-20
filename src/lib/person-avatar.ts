/**
 * Avatars on shared lists (FIL-I18): initials over a gradient whose hue is
 * fixed per person, so «AR» is the same colour on every poster and screen.
 */

export const personInitials = (name: string | null | undefined) => {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  const first = words[0]!;
  const last = words.length > 1 ? words[words.length - 1]! : "";
  return (first.charAt(0) + (last ? last.charAt(0) : first.charAt(1))).toUpperCase();
};

/** A stable hue (0–359) from the person's id. */
export const personHue = (id: string) => {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % 360;
};

/** «Ana», or «Alguien» for an account without a name; «usuario eliminado» when it is gone. */
export const personFirstName = (name: string | null | undefined, gone = false) => {
  if (gone) {
    return "Usuario eliminado";
  }
  return (name ?? "").trim().split(/\s+/)[0] || "Alguien";
};
