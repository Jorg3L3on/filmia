export const isCurrentPath = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);
