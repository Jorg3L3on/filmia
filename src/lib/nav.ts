export const isCurrentPath = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

export const mobileNavItems = [
  { href: "/", label: "Diario", icon: "diary" },
  { href: "/watchlist", label: "Quiero ver", icon: "queue" },
  { href: "/buscar", label: "Buscar", icon: "search" },
  { href: "/listas", label: "Listas", icon: "lists" },
  { href: "/perfil", label: "Perfil", icon: "profile" },
] as const;

export type MobileNavIcon = (typeof mobileNavItems)[number]["icon"];
