import { isCurrentPath } from "../src/lib/nav";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const cases: Array<{ href: string; pathname: string; expected: boolean }> = [
  { href: "/", pathname: "/", expected: true },
  { href: "/", pathname: "/listas", expected: false },
  { href: "/", pathname: "/listas/abc", expected: false },
  { href: "/", pathname: "/watchlist", expected: false },
  { href: "/", pathname: "/titulos/abc", expected: false },
  { href: "/listas", pathname: "/listas", expected: true },
  { href: "/listas", pathname: "/listas/abc", expected: true },
  { href: "/listas", pathname: "/listas/abc/editar", expected: true },
  { href: "/listas", pathname: "/", expected: false },
  { href: "/listas", pathname: "/watchlist", expected: false },
  { href: "/watchlist", pathname: "/watchlist", expected: true },
  { href: "/watchlist", pathname: "/", expected: false },
  { href: "/buscar", pathname: "/buscar", expected: true },
  { href: "/buscar", pathname: "/titulos/abc", expected: false },
];

for (const item of cases) {
  assert(
    isCurrentPath(item.href, item.pathname) === item.expected,
    `isCurrentPath(${item.href}, ${item.pathname}) should be ${item.expected}`,
  );
}

const onListas = ["/listas", "/listas/cmexample"];
for (const pathname of onListas) {
  assert(!isCurrentPath("/", pathname), `Diario must stay inactive on ${pathname}`);
  assert(isCurrentPath("/listas", pathname), `Listas must be active on ${pathname}`);
}

console.log("✓ BottomNav path matcher: Diario exact /, Listas prefix only");
