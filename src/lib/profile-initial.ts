/** The initial of a person (FIL-I21-8): their name's, or their email's when there is no name. */
export const profileInitial = (name: string | null | undefined, email: string | null | undefined) =>
  (name?.trim() || email?.trim() || "").charAt(0).toLocaleUpperCase("es-MX") || "·";
