/**
 * Quinielas de premios (FIL-I51-7): the awards the app knows, their names in Spanish and the main
 * categories each ballot asks (Jorge: only the main ones). Pure and client-safe.
 *
 * A ceremony file (`src/data/quinielas/<award>-<year>.json`) carries its own categories; these
 * templates are where `npm run quiniela:nueva` starts from and what the Oscar builder maps to. The
 * final list of each ceremony is checked against the official one when its nominees are loaded.
 */

export type QuinielaCategoryKind = "film" | "series" | "person" | "song";

export type CategoryTemplate = {
  /** Slug, unique within the award: `pelicula`, `actriz-reparto`. */
  id: string;
  /** «Mejor actriz de reparto». */
  label: string;
  /** «Actriz de reparto», for lists and the share images. */
  short: string;
  kind: QuinielaCategoryKind;
};

export type AwardId = "oscar" | "globos" | "emmy" | "bafta";

export type Award = {
  id: AwardId;
  /** «Óscar», «Globos de Oro». */
  name: string;
  /** With its article, for «Quiniela del Óscar», «La noche de los Emmy». */
  of: string;
  /** Accent of the share images (hex). */
  accent: string;
  categories: readonly CategoryTemplate[];
};

const t = (id: string, label: string, short: string, kind: QuinielaCategoryKind): CategoryTemplate => ({
  id,
  label,
  short,
  kind,
});

/** The Academy's competitive categories in ballot order; `oscar-build` maps DLu's names to them. */
const OSCAR_CATEGORIES = [
  t("pelicula", "Mejor película", "Película", "film"),
  t("direccion", "Mejor dirección", "Dirección", "person"),
  t("actriz", "Mejor actriz", "Actriz", "person"),
  t("actor", "Mejor actor", "Actor", "person"),
  t("actriz-reparto", "Mejor actriz de reparto", "Actriz de reparto", "person"),
  t("actor-reparto", "Mejor actor de reparto", "Actor de reparto", "person"),
  t("guion-original", "Mejor guion original", "Guion original", "film"),
  t("guion-adaptado", "Mejor guion adaptado", "Guion adaptado", "film"),
  t("animada", "Mejor película animada", "Animada", "film"),
  t("internacional", "Mejor película internacional", "Internacional", "film"),
  t("documental", "Mejor documental", "Documental", "film"),
  t("fotografia", "Mejor fotografía", "Fotografía", "film"),
  t("montaje", "Mejor montaje", "Montaje", "film"),
  t("casting", "Mejor casting", "Casting", "film"),
  t("diseno-produccion", "Mejor diseño de producción", "Diseño de producción", "film"),
  t("vestuario", "Mejor vestuario", "Vestuario", "film"),
  t("maquillaje", "Mejor maquillaje y peluquería", "Maquillaje", "film"),
  t("banda-sonora", "Mejor banda sonora", "Banda sonora", "film"),
  t("cancion", "Mejor canción original", "Canción", "song"),
  t("sonido", "Mejor sonido", "Sonido", "film"),
  t("efectos-visuales", "Mejores efectos visuales", "Efectos visuales", "film"),
  t("corto-documental", "Mejor cortometraje documental", "Corto documental", "film"),
  t("corto-animado", "Mejor cortometraje animado", "Corto animado", "film"),
  t("cortometraje", "Mejor cortometraje", "Cortometraje", "film"),
] as const;

/** Film and TV, the main ones (~21). */
const GLOBOS_CATEGORIES = [
  t("pelicula-drama", "Mejor película de drama", "Película drama", "film"),
  t("pelicula-comedia", "Mejor película musical o de comedia", "Película comedia", "film"),
  t("direccion", "Mejor dirección", "Dirección", "person"),
  t("actriz-drama", "Mejor actriz en película de drama", "Actriz drama", "person"),
  t("actor-drama", "Mejor actor en película de drama", "Actor drama", "person"),
  t("actriz-comedia", "Mejor actriz en película musical o de comedia", "Actriz comedia", "person"),
  t("actor-comedia", "Mejor actor en película musical o de comedia", "Actor comedia", "person"),
  t("actriz-reparto", "Mejor actriz de reparto en película", "Actriz de reparto", "person"),
  t("actor-reparto", "Mejor actor de reparto en película", "Actor de reparto", "person"),
  t("guion", "Mejor guion", "Guion", "film"),
  t("animada", "Mejor película animada", "Animada", "film"),
  t("habla-no-inglesa", "Mejor película de habla no inglesa", "Habla no inglesa", "film"),
  t("cancion", "Mejor canción original", "Canción", "song"),
  t("banda-sonora", "Mejor banda sonora", "Banda sonora", "film"),
  t("serie-drama", "Mejor serie de drama", "Serie drama", "series"),
  t("serie-comedia", "Mejor serie musical o de comedia", "Serie comedia", "series"),
  t("serie-limitada", "Mejor serie limitada o película para televisión", "Serie limitada", "series"),
  t("actriz-serie-drama", "Mejor actriz en serie de drama", "Actriz serie drama", "person"),
  t("actor-serie-drama", "Mejor actor en serie de drama", "Actor serie drama", "person"),
  t("actriz-serie-comedia", "Mejor actriz en serie musical o de comedia", "Actriz serie comedia", "person"),
  t("actor-serie-comedia", "Mejor actor en serie musical o de comedia", "Actor serie comedia", "person"),
] as const;

/** Primetime: series, acting and directing (~15). */
const EMMY_CATEGORIES = [
  t("serie-drama", "Mejor serie de drama", "Serie drama", "series"),
  t("serie-comedia", "Mejor serie de comedia", "Serie comedia", "series"),
  t("serie-limitada", "Mejor serie limitada o antológica", "Serie limitada", "series"),
  t("actriz-drama", "Mejor actriz principal en serie de drama", "Actriz drama", "person"),
  t("actor-drama", "Mejor actor principal en serie de drama", "Actor drama", "person"),
  t("actriz-comedia", "Mejor actriz principal en serie de comedia", "Actriz comedia", "person"),
  t("actor-comedia", "Mejor actor principal en serie de comedia", "Actor comedia", "person"),
  t("actriz-limitada", "Mejor actriz principal en serie limitada", "Actriz limitada", "person"),
  t("actor-limitada", "Mejor actor principal en serie limitada", "Actor limitada", "person"),
  t("actriz-reparto-drama", "Mejor actriz de reparto en serie de drama", "Reparto drama (actriz)", "person"),
  t("actor-reparto-drama", "Mejor actor de reparto en serie de drama", "Reparto drama (actor)", "person"),
  t("actriz-reparto-comedia", "Mejor actriz de reparto en serie de comedia", "Reparto comedia (actriz)", "person"),
  t("actor-reparto-comedia", "Mejor actor de reparto en serie de comedia", "Reparto comedia (actor)", "person"),
  t("direccion-drama", "Mejor dirección en serie de drama", "Dirección drama", "person"),
  t("direccion-comedia", "Mejor dirección en serie de comedia", "Dirección comedia", "person"),
] as const;

/** The British Academy's main film categories (~16). */
const BAFTA_CATEGORIES = [
  t("pelicula", "Mejor película", "Película", "film"),
  t("pelicula-britanica", "Mejor película británica", "Película británica", "film"),
  t("direccion", "Mejor dirección", "Dirección", "person"),
  t("actriz", "Mejor actriz", "Actriz", "person"),
  t("actor", "Mejor actor", "Actor", "person"),
  t("actriz-reparto", "Mejor actriz de reparto", "Actriz de reparto", "person"),
  t("actor-reparto", "Mejor actor de reparto", "Actor de reparto", "person"),
  t("guion-original", "Mejor guion original", "Guion original", "film"),
  t("guion-adaptado", "Mejor guion adaptado", "Guion adaptado", "film"),
  t("habla-no-inglesa", "Mejor película de habla no inglesa", "Habla no inglesa", "film"),
  t("animada", "Mejor película animada", "Animada", "film"),
  t("documental", "Mejor documental", "Documental", "film"),
  t("fotografia", "Mejor fotografía", "Fotografía", "film"),
  t("montaje", "Mejor montaje", "Montaje", "film"),
  t("banda-sonora", "Mejor banda sonora", "Banda sonora", "film"),
  t("vestuario", "Mejor vestuario", "Vestuario", "film"),
] as const;

export const AWARDS: Readonly<Record<AwardId, Award>> = {
  oscar: { id: "oscar", name: "Óscar", of: "del Óscar", accent: "#f2c14e", categories: OSCAR_CATEGORIES },
  globos: { id: "globos", name: "Globos de Oro", of: "de los Globos de Oro", accent: "#e9a23b", categories: GLOBOS_CATEGORIES },
  emmy: { id: "emmy", name: "Emmy", of: "de los Emmy", accent: "#8fc7f0", categories: EMMY_CATEGORIES },
  bafta: { id: "bafta", name: "BAFTA", of: "de los BAFTA", accent: "#d9d4c7", categories: BAFTA_CATEGORIES },
};

export const isAwardId = (value: unknown): value is AwardId =>
  typeof value === "string" && Object.hasOwn(AWARDS, value);

/** «Quiniela del Óscar 2027». */
export const quinielaTitle = (award: AwardId, year: number) => `Quiniela ${AWARDS[award].of} ${year}`;

/** «La noche de los Emmy». */
export const nightTitle = (award: AwardId) => `La noche ${AWARDS[award].of}`;

/** `oscar-2027`: the id every table and route uses. */
export const ceremonyIdOf = (award: AwardId, year: number) => `${award}-${year}`;

const CEREMONY_ID = /^(oscar|globos|emmy|bafta)-(\d{4})$/;

/** `oscar-2027` → its parts, or null for anything that is not a ceremony id. */
export const parseCeremonyId = (value: unknown): { award: AwardId; year: number } | null => {
  const match = typeof value === "string" ? CEREMONY_ID.exec(value) : null;
  return match ? { award: match[1] as AwardId, year: Number(match[2]) } : null;
};
