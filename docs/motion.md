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

## SharedPoster

React `<ViewTransition name={\`poster-${id}\`} share="morph">` via `SharedPoster` on tile → ficha paths (lists, tags results, buscar, deck, calendar, rail, ranking, watchlist).

## Reduced motion

`prefers-reduced-motion: reduce` zeroes animations, transitions, and view-transition image pairs.
