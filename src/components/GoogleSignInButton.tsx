import { googleSignInHref } from "@/lib/google-oauth";
import { buttonClass } from "@/lib/ui";

type GoogleSignInButtonProps = {
  /** Same-origin path to land on after Google; defaults to the home screen. */
  next?: string | null;
  label?: string;
};

/**
 * Plain anchor on purpose: the start route is a GET that sets a cookie and
 * redirects, so it must be a full navigation (no `<Link>` prefetch).
 */
export const GoogleSignInButton = ({
  next,
  label = "Continuar con Google",
}: GoogleSignInButtonProps) => (
  <a
    href={googleSignInHref(next)}
    className={buttonClass({
      variant: "secondary",
      className:
        "w-full gap-2.5 press-scale transition-[transform,background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
    })}
  >
    <GoogleMark />
    {label}
  </a>
);

/** Separator between the Google button and the email form. */
export const AuthDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 text-xs text-mist" aria-hidden="true">
    <span className="h-px flex-1 bg-line" />
    {label}
    <span className="h-px flex-1 bg-line" />
  </div>
);

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
    />
  </svg>
);
