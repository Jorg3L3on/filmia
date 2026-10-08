# Filmia motion (Fase 2 / Artist lock)

Canonical tokens live in `src/app/globals.css` (`:root` + comment block).

## Durations

| Token | ms | Use |
| --- | ---: | --- |
| `--duration-press` | 160 | press-scale |
| `--duration-tab` | 200 | `.tab-transition` (bottom nav, toggles) |
| `--duration-hover` | 220 | `.card-physics` hover |
| `--duration-enter` / `--duration-toast` | 280 | fade-up, toast in/out |
| `--duration-morph` | 380 | SharedPoster ViewTransition `poster-{id}` |
| `--duration-stagger` / `--duration-pop` | 420 | `.stagger-in`, `.spring-pop` |
| `--duration-sheet` | 480 | `.sheet-rise` sheet open |

## Curves

- **`--ease-out`** — sheets, toasts, tabs, stagger, morph (no overshoot).
- **`--spring`** — **only** press / spring-pop / spring-fill (chips, log, rating feedback).

Sheets open with `.sheet-rise` (translateY + ease-out). **Never** `.spring-pop` for sheet open.

## Tarjetas: hover + press

| Piece | Token | Notes |
| --- | --- | --- |
| Hover `.card-physics:hover` | `--duration-hover` · `--ease-out` | Lift −3 px, scale 1.02, brightness 1.06. **Only under `@media (hover: hover)`**: on touch `:hover` sticks after a tap and stacked with the press (1.02 → 0.96 → 1.02). |
| Press `.press-scale:active` | `--duration-press` · `--spring` | Scale 0.96. The only transform feedback a tap gets on touch. |
| Both `.card-physics.press-scale` | press for `transform`, hover for shadow/filter | One element owns the transform; never nest a second scaling wrapper (ListCard, PosterTile, rails). |

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

## Perfil

Direction A «Marquesina» (FIL-I5-3, canvas https://claude.ai/artifact/2rSJnRDQ5tNQbNaZp396u8).

| Piece | Token | Notes |
| --- | --- | --- |
| Nombre `.perfil-name-in` | `--duration-enter` · `--ease-out` | Reuses `genre-coverflow-title-in` (blur-in, magicui Blur Fade). |
| Luz `.perfil-glow` / `.perfil-poster-wash` | 9 s breath · 1.2 s wash-in · `--ease-out` | Accent glow + the last Diario poster blurred behind the name; `.perfil-light` masks the edges. |
| Filas → hoja (hora, Nombre, Correo, Contraseña) | `.sheet-rise` · `--duration-sheet` | beui Bottom Sheet; designspells «Smooth sheet transitions in Sudoku a Day». Hover/press tint on rows: `--duration-hover` · `--ease-out`. |
| Hora de dormir (hoja) | `.hour-tick` / `.bedtime-moon` | `BedtimeDial`, the Bienvenida drum (beui Wheel Picker); `data-no-sheet-drag` so the drum scrolls instead of closing the sheet. |
| Campo con foco `.profile-sheet input` | `--duration-tab` · `--ease-out` | Ring grows out from the border (easyui LockInput); invalid fields turn `danger-well`. |
| Error | 320 ms · `--spring` (WAAPI) | One shake per failed attempt (beui Input). Typed values survive (fields are controlled). Skipped with reduced motion. |
| Guardar → toast | `press-scale` · `--duration-toast` | «Nombre guardado» / «Correo guardado» / «Contraseña actualizada»; the sheet closes on success. |
| Plataformas | `press-scale` · `--duration-hover` | Yours first (order fixed at mount), folded to 6; «Ver las 14» unfolds. |
| Salir | `press-scale` · `--duration-hover` | Danger tokens, exit icon nudges 2 px on hover (beui Animated CTA «slide»); «Saliendo…» with a spinner. |

## Buscar

| Piece | Token | Notes |
| --- | --- | --- |
| Dock → campo (móvil, /buscar) | `--duration-morph` (380 ms) · `--ease-out` | React `<ViewTransition name="dock-shell" \| "dock-search" share="morph">`: the four tabs fold into the left disc (the tab you came from) and the center disc stretches into the glass field; the left disc does the reverse. Only the dock's own taps carry the `dock-search` transition type (`<Link transitionTypes>`), so tab-to-tab, browser back and other routes into Buscar swap without a morph and the sliding pill keeps its own motion. Reduced motion: 200 ms crossfade, no travel or scale. |
| Campo `.dock-field` | `--duration-tab` · `--ease-out` | Focus ring grows (accent border + 3 px halo). 16 px input (no iOS zoom); ✕ clears and keeps focus; with the keyboard open the dock rides `visualViewport` (bottom = keyboard height). |
| Disco del dock `.dock-search` | `--duration-tab` · `--ease-out` (luz) · `--duration-press` · `--spring` (press) | Center glass disc → /buscar (replaced the «+» menu). On /buscar it lights with the accent aura (`aria-current="page"`) while `.dock-indicator` fades out; elsewhere it is plain glass. Reduced motion: color/opacity only, no scale. |
| Filas `.stagger-in` | `--duration-stagger` · 50 ms/row | `SearchResultRow`: title up to 2 lines, poster and chevron never shrink. |
| Persona `.person-card-in` | `--duration-stagger` · `--ease-out` | Person card (photo, name, role line) and the «Ver filmografía» suggestion blur in with `genre-coverflow-title-in`; the filmography rows use `.stagger-in`. Reduced motion: no animation. |
| Insignia de biblioteca | — | `SearchResultRow` shows a small glass disc: bookmark (En Quiero ver) or check (Vista). Static. |
| «Dirigida por» → filmografía | `--duration-hover` · `--ease-out` (subrayado) · `--duration-press` · `--spring` (pill) | Hoy's reason pill splits into «Por qué» (spark) + the name as its own link (taller hit area, `.tonight-reason-person::after`); Quiero ver's expanded ficha links each director / creator. Subtle underline that lights on hover / focus (`personLinkClass`). Both open `/buscar?persona=<id>&rol=director`. |
| «Ver esta noche» `.tonight-pin` | `--duration-press` · `--spring` (press) · `--duration-pop` · `--spring` (luna) | The sheet's one primary action. Pending «Reservando…»; done, the crescent fills with `.spring-pop` only right after the tap (reopening the sheet shows it full, no pop) and the toast «Ver en Hoy» stays 6 s. The sheet never closes on its own. |
| Fila «Fichas» `SearchResultRow` | `--duration-hover` · `--ease-out` (borde, chevron +2 px) · `press-scale` | FIL-I5-4, direction A: La cartelera's glass row, 56 px poster, serif title, original title in italics, pill «En Quiero ver» / «La viste». |
| Chips `.buscar-chip-pill` | `--duration-tab` · `--ease-out` | One aura pill slides under the current chip (beui Tabs); placed before paint, animates only after the first placement. Reduced motion: jumps. |
| Conteo `.num-ticker-col` | `--duration-morph` · `--ease-out` | «11 resultados» rolls like La cartelera's count (magicui Number Ticker); stays mounted while searching. Tabular digits. |
| «Buscando…» `.buscar-shiny` | 1.6 s linear loop | Light sweeps across the words (magicui Animated Shiny Text). Reduced motion: static mist. |
| Inicio: Recientes `.stagger-in` · Directores `.person-card-in` | `--duration-stagger` · 50 ms/item | Before typing: this device's recent searches (localStorage) and directors of your Favoritas / 4★+ (magicui Avatar Circles idea, as a rail). Photo ring lights accent on hover. |

## SharedPoster

React `<ViewTransition name={\`poster-${id}\`} share="morph">` via `SharedPoster` on tile → ficha paths (lists, buscar, deck, calendar, rail, ranking, watchlist).

`poster-{id}` must be mounted at most once per page. Where the same title can appear twice (PosterStack, the watchlist stage, the Perfil week strip next to «Últimas entradas»), pass `share={false}` to the secondary occurrence so only one tile owns the morph.

## Reduced motion

`prefers-reduced-motion: reduce` zeroes animations, transitions, and view-transition image pairs.
