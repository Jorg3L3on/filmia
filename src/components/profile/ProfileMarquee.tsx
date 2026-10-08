import { tmdbPosterUrl } from "@/lib/tmdb";

type ProfileMarqueeProps = {
  name: string | null;
  email: string;
  /** Last poster in the Diario: its blurred light sits behind the name. */
  posterPath: string | null;
};

/** Perfil top: your name in serif where the letter avatar used to be (email if there is no name). */
export const ProfileMarquee = ({ name, email, posterPath }: ProfileMarqueeProps) => {
  const poster = tmdbPosterUrl(posterPath, "w342");
  const displayName = name?.trim() || email;
  return (
    <header className="relative isolate pt-2 pb-1">
      <div className="perfil-light" aria-hidden="true">
        <div className="perfil-glow" />
        {poster ? <div className="perfil-poster-wash" style={{ backgroundImage: `url(${poster})` }} /> : null}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Perfil</p>
      <h1 className="perfil-name-in mt-1.5 font-serif text-[2.5rem] leading-[1.05] tracking-[-0.01em] text-paper break-words sm:text-[3.25rem]">
        {displayName}
      </h1>
      {name?.trim() ? <p className="mt-1 truncate text-sm text-fog">{email}</p> : null}
    </header>
  );
};
