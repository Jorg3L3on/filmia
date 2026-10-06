import { wellClass } from "@/lib/ui";

type ProfileGoogleAccessProps = {
  hasPassword: boolean;
};

/** Shown on Perfil when the account is linked to Google. */
export const ProfileGoogleAccess = ({ hasPassword }: ProfileGoogleAccessProps) => (
  <section className={`${wellClass} space-y-2 p-5`}>
    <header className="flex items-center gap-2">
      <GoogleIcon />
      <h2 className="text-lg font-semibold text-paper">Acceso con Google</h2>
    </header>
    <p className="text-sm text-mist">
      {hasPassword
        ? "Esta cuenta entra con Google y también con tu correo y contraseña."
        : "Esta cuenta entra con Google. No tiene contraseña: usa «Continuar con Google» para entrar."}
    </p>
  </section>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path strokeLinecap="round" d="M12 12h6.5M12 8.5v7" />
  </svg>
);
