/**
 * The ficha's trailer (FIL-I15-1): one YouTube «Trailer» out of TMDB's
 * `/videos`, Mexican Spanish first, then any Spanish, then English. Official
 * uploads win inside a language; an unofficial one only when there is no
 * official trailer at all. Anything else (teasers, clips, Vimeo) is ignored.
 */

export type TmdbVideo = {
  key?: string | null;
  site?: string | null;
  type?: string | null;
  official?: boolean | null;
  iso_639_1?: string | null;
  iso_3166_1?: string | null;
  published_at?: string | null;
  name?: string | null;
};

export type TmdbVideosPayload = { results?: TmdbVideo[] | null };

export type Trailer = {
  /** YouTube video id. */
  key: string;
  name: string | null;
};

/** TMDB's `include_video_language` for the request: everything `pickTrailer` may choose. */
export const TRAILER_VIDEO_LANGUAGES = "es,en";

const YOUTUBE_KEY = /^[\w-]{6,20}$/;

/** 0 es-MX · 1 es · 2 en · null otherwise. */
const languageRank = (video: TmdbVideo) => {
  const language = video.iso_639_1?.toLowerCase();
  if (language === "es") {
    return video.iso_3166_1?.toUpperCase() === "MX" ? 0 : 1;
  }
  return language === "en" ? 2 : null;
};

const publishedAt = (video: TmdbVideo) => {
  const time = video.published_at ? Date.parse(video.published_at) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
};

export const pickTrailer = (payload: TmdbVideosPayload | null | undefined): Trailer | null => {
  const candidates = (payload?.results ?? []).flatMap((video) => {
    const rank = languageRank(video);
    const key = video.key?.trim() ?? "";
    if (
      rank == null ||
      video.site !== "YouTube" ||
      video.type !== "Trailer" ||
      !YOUTUBE_KEY.test(key)
    ) {
      return [];
    }
    return [{ video, key, rank, official: video.official === true }];
  });

  const anyOfficial = candidates.some((candidate) => candidate.official);
  const best = candidates
    .filter((candidate) => candidate.official || !anyOfficial)
    .sort(
      (a, b) => a.rank - b.rank || publishedAt(b.video) - publishedAt(a.video),
    )[0];

  return best ? { key: best.key, name: best.video.name?.trim() || null } : null;
};

/** Privacy-enhanced embed, no related videos from other channels; plays once the sheet opens. */
export const trailerEmbedUrl = (key: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?rel=0&autoplay=1&playsinline=1&modestbranding=1`;
