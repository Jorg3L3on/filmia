const pathOnly = (pathname: string) => pathname.split("?")[0] ?? pathname;

/** Perfil is no tab since FIL-I60-1: it is the avatar at the top right, on phone and desktop. */
export const PROFILE_HREF = "/perfil";

/** Full-screen routes without header/dock: auth screens, the Bienvenida and public shares. */
export const isAuthChromePath = (pathname: string) => {
  const path = pathOnly(pathname);
  return (
    path === "/login" ||
    path === "/registro" ||
    path === "/bienvenida" ||
    path.startsWith("/login/") ||
    path.startsWith("/registro/") ||
    path.startsWith("/bienvenida/") ||
    path.startsWith("/compartir/") ||
    // MCP connector consent (FIL-I20): a standalone screen like sign-in.
    path === "/oauth/consent" ||
    path === "/conector"
  );
};

/** The ficha is immersive on mobile (FIL-I4, dirección A): no global header, the back pill floats on the backdrop. */
export const isImmersiveFichaPath = (pathname: string) =>
  /^\/titulos\/(?:[^/]+|tmdb\/(?:pelicula|serie)\/\d+)\/?$/.test(pathOnly(pathname));

export const isListasHubPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/listas" || path.startsWith("/listas/");
};

/** Para ti (FIL-I60): discovery outside your lists. */
export const isParaTiPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/para-ti" || path.startsWith("/para-ti/");
};

/** Perfil and Tu diario: what the avatar lights since Perfil left the dock (FIL-I60-1). */
export const isProfilePath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/perfil" || path.startsWith("/perfil/") || path === "/diario" || path.startsWith("/diario/");
};

export const isCinePath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/cine" || path.startsWith("/cine/");
};

/** A ficha belongs to no tab: it lights the tab it was opened from (FIL-I44-8). */
export const isTitlePath = (pathname: string) => pathOnly(pathname).startsWith("/titulos/");

export const isCurrentPath = (href: string, pathname: string) => {
  const path = pathOnly(pathname);
  if (href === "/") {
    return path === "/";
  }
  if (href === "/listas") {
    return isListasHubPath(pathname);
  }
  return path === href || path.startsWith(`${href}/`);
};

/** Tu diario (calendario / historial) lives under Perfil since Hoy took the home tab. */
export const isDiaryPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/diario" || path.startsWith("/diario/");
};

/** Quiero ver is pinned inside Listas (FIL-34): its page lights the Listas tab. */
export const isWatchlistPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/watchlist" || path.startsWith("/watchlist/");
};

/** Extras (FIL-I50, code name «juegos») belongs to Hoy: its only doors are there, and the dock keeps Hoy lit. */
export const isJuegosPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/extras" || path.startsWith("/extras/");
};

/**
 * A game being played (La tanda): no dock, the answer buttons own the bottom of the screen. A reto
 * by link (`/reto/…`, FIL-I53-4) is a game too, often opened by someone without an account.
 */
export const isJuegoPlayPath = (pathname: string) =>
  (isJuegosPath(pathname) && pathOnly(pathname) !== "/extras") || pathOnly(pathname).startsWith("/reto/");

/**
 * Bottom-nav active state: Para ti on /para-ti/*; Cine on /cine/*; Listas on the hub and on
 * Quiero ver (FIL-34); Hoy on Extras. `/perfil` is the avatar's href (FIL-I60-1): it lights on
 * /perfil and Tu diario.
 */
export const isMobileNavCurrent = (href: string, pathname: string) => {
  if (href === "/") {
    return isCurrentPath("/", pathname) || isJuegosPath(pathname);
  }
  if (href === "/para-ti") {
    return isParaTiPath(pathname);
  }
  if (href === "/cine") {
    return isCinePath(pathname);
  }
  if (href === "/listas") {
    return isListasHubPath(pathname) || isWatchlistPath(pathname);
  }
  if (href === PROFILE_HREF) {
    return isProfilePath(pathname);
  }
  return isCurrentPath(href, pathname);
};

export const desktopNavItems = [
  { href: "/", label: "Hoy" },
  { href: "/para-ti", label: "Para ti" },
  { href: "/buscar", label: "Buscar" },
  { href: "/listas", label: "Listas" },
  { href: "/cine", label: "Cine" },
] as const;

/** Desktop header tabs light up like the dock: Cine on /cine/*, Listas on Quiero ver. */
export const isDesktopNavCurrent = (href: string, pathname: string) => isMobileNavCurrent(href, pathname);

/**
 * The tab matcher for the dock and the desktop header: a ficha lights the last tab the person was
 * on (`originTab`, kept in sessionStorage by the dock), Hoy when there is none (FIL-I44-8).
 */
export const navTabMatcher = (originTab: string | null) => (href: string, pathname: string) =>
  isTitlePath(pathname) ? href === (originTab ?? "/") : isMobileNavCurrent(href, pathname);

/** Bottom tab bar: four tabs around the center Buscar disc (Hoy · Para ti · [Buscar] · Listas · Cine). */
export const mobileNavItems = [
  { href: "/", label: "Hoy", icon: "today" },
  { href: "/para-ti", label: "Para ti", icon: "para-ti" },
  { href: "/listas", label: "Listas", icon: "lists" },
  { href: "/cine", label: "Cine", icon: "ticket" },
] as const;

/** Perfil as an origin (Buscar's back disc, a ficha opened from Perfil): never drawn as a dock tab. */
export const profileNavOrigin = { href: PROFILE_HREF, label: "Perfil", icon: "profile" } as const;

/**
 * Where the floating avatar sits on a phone (FIL-I60-1): the top pages of each tab, Perfil and
 * Tu diario. Not on fichas, inner screens with a back disc, games, auth or Bienvenida. Buscar
 * carries it in its top row instead (see BottomNav).
 */
export const showsFloatingAvatar = (pathname: string) => {
  const path = pathOnly(pathname).replace(/\/$/, "") || "/";
  return (
    path === "/" ||
    path === "/para-ti" ||
    path === "/listas" ||
    path === "/watchlist" ||
    path === "/cine" ||
    path === "/perfil" ||
    path === "/diario"
  );
};

/** Center glass disc of the dock: Buscar is how titles get into Filmia. */
export const mobileNavSearch = { href: "/buscar", label: "Buscar", icon: "search" } as const;

/** React transition type of the dock's own taps: the dock ⇄ Buscar field morph. */
export const DOCK_SEARCH_TRANSITION = "dock-search";

/** Grid column the Buscar disc occupies (between Para ti and Listas). */
export const mobileNavSearchSlot = 2;

export type MobileNavIcon =
  | (typeof mobileNavItems)[number]["icon"]
  | typeof mobileNavSearch.icon
  | typeof profileNavOrigin.icon;
