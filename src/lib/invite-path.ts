/** Where a list invite lives (FIL-I18-3). No crypto here: client components import it. */
export const invitePath = (token: string) => `/unirse/${token}`;

/** A new account coming from an invite goes back to it before the Bienvenida. */
export const isInvitePath = (path: string) => path.startsWith("/unirse/");
