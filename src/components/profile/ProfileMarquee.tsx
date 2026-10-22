import { tmdbPosterUrl } from "@/lib/tmdb";

type ProfileMarqueeProps = {
  name: string | null;
  email: string;
  /** Last poster in the Diario: its blurred light sits behind the name. */
  posterPath: string | null;
};

/** Perfil top: the initial in the app icon's gradient, your name in serif and the email below (email as the name when there is none). */
export const ProfileMarquee = ({ name, email, posterPath }: ProfileMarqueeProps) => {
  const poster = tmdbPosterUrl(posterPath, "w342");
  const trimmed = name?.trim() || "";
  const displayName = trimmed || email;
  // The initial (FIL-I21-8): the name's, or the email's when there is no name.
  const initial = (trimmed || email).trim().charAt(0).toUpperCase() || "·";
  return (
    <header className="relative isolate pt-2 pb-1">
      <div className="perfil-light" aria-hidden="true">
        <div className="perfil-glow" />
        {poster ? <div className="perfil-poster-wash" style={{ backgroundImage: `url(${poster})` }} /> : null}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Perfil</p>
      <div className="mt-1.5 flex items-start gap-3.5">
        <span className="perfil-initial" aria-hidden="true" data-perfil-initial>
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="perfil-name-in font-serif text-[2.25rem] leading-[1.05] tracking-[-0.01em] text-paper break-words sm:text-[3.25rem]">
            {displayName}
          </h1>
          {trimmed ? <p className="mt-1 truncate text-sm text-fog">{email}</p> : null}
        </div>
      </div>
    </header>
  );
};
