const pathOnly = (pathname: string) => pathname.split("?")[0] ?? pathname;

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

/** A game being played (La tanda): no dock, the answer buttons own the bottom of the screen. */
export const isJuegoPlayPath = (pathname: string) => isJuegosPath(pathname) && pathOnly(pathname) !== "/extras";

/**
 * Bottom-nav active state: Cine on /cine/*; Listas on the hub and on Quiero ver (FIL-34);
 * Perfil on /perfil and Tu diario; Hoy on Extras.
 */
export const isMobileNavCurrent = (href: string, pathname: string) => {
  if (href === "/") {
    return isCurrentPath("/", pathname) || isJuegosPath(pathname);
  }
  if (href === "/cine") {
    return isCinePath(pathname);
  }
  if (href === "/listas") {
    return isListasHubPath(pathname) || isWatchlistPath(pathname);
  }
  if (href === "/perfil") {
    return isCurrentPath("/perfil", pathname) || isDiaryPath(pathname);
  }
  return isCurrentPath(href, pathname);
};

export const desktopNavItems = [
  { href: "/", label: "Hoy" },
  { href: "/listas", label: "Listas" },
  { href: "/buscar", label: "Buscar" },
  { href: "/cine", label: "Cine" },
  { href: "/perfil", label: "Perfil" },
] as const;

/** Desktop header tabs light up like the dock: Cine on /cine/*, Listas on Quiero ver, Perfil on Tu diario. */
export const isDesktopNavCurrent = (href: string, pathname: string) => isMobileNavCurrent(href, pathname);

/**
 * The tab matcher for the dock and the desktop header: a ficha lights the last tab the person was
 * on (`originTab`, kept in sessionStorage by the dock), Hoy when there is none (FIL-I44-8).
 */
export const navTabMatcher = (originTab: string | null) => (href: string, pathname: string) =>
  isTitlePath(pathname) ? href === (originTab ?? "/") : isMobileNavCurrent(href, pathname);

/** Bottom tab bar: four tabs around the center Buscar disc. */
export const mobileNavItems = [
  { href: "/", label: "Hoy", icon: "today" },
  { href: "/listas", label: "Listas", icon: "lists" },
  { href: "/cine", label: "Cine", icon: "ticket" },
  { href: "/perfil", label: "Perfil", icon: "profile" },
] as const;

/** Center glass disc of the dock: Buscar is how titles get into Filmia. */
export const mobileNavSearch = { href: "/buscar", label: "Buscar", icon: "search" } as const;

/** React transition type of the dock's own taps: the dock ⇄ Buscar field morph. */
export const DOCK_SEARCH_TRANSITION = "dock-search";

/** Grid column the Buscar disc occupies (between Listas and Cine). */
export const mobileNavSearchSlot = 2;

export type MobileNavIcon =
  | (typeof mobileNavItems)[number]["icon"]
  | typeof mobileNavSearch.icon;
