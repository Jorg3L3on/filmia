import "server-only";

import { oscarsForImdbId } from "@/lib/oscars";
import { resolvePersonOscars, type PersonOscars } from "@/lib/person-oscars";
import { findTmdbMovieByImdbId } from "@/lib/tmdb";

/** The person's Óscar with Spanish titles and posters (FIL-I43); null when there are none or on any error. */
export const loadPersonOscars = async (imdbId: string | null | undefined): Promise<PersonOscars | null> => {
  try {
    return await resolvePersonOscars(oscarsForImdbId(imdbId), findTmdbMovieByImdbId);
  } catch {
    return null;
  }
};
