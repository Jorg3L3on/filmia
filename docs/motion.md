# Filmia motion (Fase 2 / Artist lock)

Canonical tokens live in `src/app/globals.css` (`:root` + comment block).

## Durations

| Token | ms | Use |
| --- | ---: | --- |
| `--duration-press` | 160 | press-scale |
| `--duration-tab` | 200 | `.tab-transition` (bottom nav, Listas\|Etiquetas, toggles) |
| `--duration-hover` | 220 | `.card-physics` hover |
| `--duration-enter` / `--duration-toast` | 280 | fade-up, toast in/out |
| `--duration-morph` | 380 | SharedPoster ViewTransition `poster-{id}` |
| `--duration-stagger` / `--duration-pop` | 420 | `.stagger-in`, `.spring-pop` |
| `--duration-sheet` | 480 | `.sheet-rise` sheet open |

## Curves

- **`--ease-out`** — sheets, toasts, tabs, stagger, morph (no overshoot).
- **`--spring`** — **only** press / spring-pop / spring-fill (chips, log, rating feedback).

Sheets open with `.sheet-rise` (translateY + ease-out). **Never** `.spring-pop` for sheet open.

## Esta noche (Hoy)

| Piece | Token | Notes |
| --- | --- | --- |
| Talón `.ticket-stub` | `--duration-press` · `--spring` (arm) | Drag down; perforation arms at 60 px (haptic), tears with `stub-tear` 420 ms ease-out. Tap = same result. |
| Sello `.visto-stamp` | `--duration-pop` · `--spring` | 1.6 → 0.96 → 1, −12°, after «Guardar». |
| Vuelo `.fly-poster` → `.nav-receive` | 620 ms ease-out · 900 ms spring pulse | Poster clone flies into the Perfil tab (Web Animations); reduced motion = pulse only. |
| Reparto `.deck-deal` | `--duration-stagger` · `--spring` · 50 ms/card | On mount and on lens change (`--deal-i` per card). |
| Razón / título `.tonight-title-in` | `--duration-enter` · `--ease-out` | Reuses `genre-coverflow-title-in` (blur-in). |

## Quiero ver (La cartelera)

| Piece | Token | Notes |
| --- | --- | --- |
| Fichas `.stagger-in` | `--duration-stagger` · 50 ms/row (cap 12) | Entry of the list, same as every grid. |
| Abrir ficha `.ficha-detail` | 420 ms · `--spring` | `grid-template-rows: 0fr → 1fr`. The one sanctioned spring outside press/pop: it answers a direct tap. Poster 64 → 84 px and title 15 → 23 px ride the same spring; the backdrop `.ficha-backdrop` fades in with `--ease-out` and settles from scale 1.06 over 1.2 s. |
| Detalle `.ficha-detail-in` | `--duration-enter` · `--ease-out` · 120 ms delay | Opacity + blur(6px) + 6 px rise, fill-mode `backwards`. |
| Swipe `.ficha-sheet` | `--duration-hover` · `--ease-out` (spring back) | Axis locks after 8 px; arms at 60 px (haptic 12 ms, label pops with `spring-pop`), stops at 96. Right = «Vi esto», left = «Ahora no». |
| Sello `.visto-stamp.is-row` | `--duration-pop` · `--spring` | Same stamp as Hoy at row size; 520 ms later the poster flies to Perfil (`.fly-poster`). |
| Conteo `.num-ticker-col` | `--duration-morph` · `--ease-out` | Digits roll when a chip changes the count. |
| Título condensado `.cartelera-condensed-title` | `--duration-tab` · `--ease-out` | Appears in the sticky bar once the H1 scrolls away (IntersectionObserver). |
| Menú / nota / género | `.sheet-rise` | Bottom sheets, never spring. |

## Bienvenida (first run)

| Piece | Token | Notes |
| --- | --- | --- |
| Pasos `.bienvenida-forward` / `.bienvenida-back` | 320 ms · `--ease-out` | React `<ViewTransition key={step}>` + `addTransitionType` inside `startTransition`; reuses the diary `slide-*` keyframes. Strip + action bar anchored (`.bienvenida-chrome`). |
| Agujeros `.film-hole.is-current` | `--duration-pop` · `--spring` | Sprocket pops when the step changes (direct consequence of the tap). |
| Sello `.visto-stamp.is-tile` · corona `.year-crown` · check `.year-check` | `--duration-pop` · `--spring` | Tap feedback on poster tiles. |
| Fondo `.bienvenida-glow` / `.bienvenida-poster-wash` | 9 s breath · 1.2 s wash-in · `--ease-out` | Sampled `--que-ver-glow` from the favorite poster. |
| Tambor `.hour-tick` / luna `.bedtime-moon` | `--duration-tab` / `--duration-morph` · `--ease-out` | Scroll-snap drum; moon rises with `--elev`. |
| Payoff `.payoff-card-in` | `--duration-stagger` · `--ease-out` | Same blur-in as `genre-coverflow-title-in`. |

## SharedPoster

React `<ViewTransition name={\`poster-${id}\`} share="morph">` via `SharedPoster` on tile → ficha paths (lists, tags results, buscar, deck, calendar, rail, ranking, watchlist).

## Reduced motion

`prefers-reduced-motion: reduce` zeroes animations, transitions, and view-transition image pairs.
