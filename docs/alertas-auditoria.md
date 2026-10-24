# Auditoría FIL-I28 · `showToast` en `sandbox` `8c4c0ee`

Parada. El brief pide **76 llamadas de `showToast` en 25 archivos de producción**. En este HEAD no sale ese número. No hay migración de póster, copy ni «Reintentar», ni helper nuevo, ni cambio del contrato de `src/lib/toast.ts`.

Este documento es el entregable de FIL-I28-1 en el estado en que el conteo lo deja: inventario vivo, no la tabla de 32 errores ni la de copy antes/después de 76 filas. Esas dos tablas exigirían recortar o ampliar el inventario a mano.

## Cómo se contó

Patrón `showToast(` en `src/**/*.ts` y `src/**/*.tsx`, HEAD `8c4c0ee` (`Merge pull request #187`).

Quedan fuera del conteo de producción:

- `src/lib/toast.test.ts` (pruebas del store).
- `src/components/toast/ToastBench.tsx` (6 llamadas). Es el banco de desarrollo de FIL-I27; la página no está en producción.

Cada `showToast(` cuenta, también el que vive dentro del `onClick` de otro toast («No se pudo deshacer»).

## Resultado

| Conjunto | Archivos | Llamadas `showToast(` |
| --- | ---: | ---: |
| Brief | 25 | 76 |
| Esos 25 archivos, en este HEAD | 25 | **81** |
| Producción fuera de esos 25 | 7 | **17** |
| Producción total (sin banco ni tests) | 32 | **98** |

Por zona del brief:

| Zona | Archivos del brief | Llamadas que pide el brief | Llamadas vivas |
| --- | --- | ---: | ---: |
| (a) Diario / Ficha | 7 | 17 | **18** |
| (b) Hoy / Quiero ver | 5 | 32 | **36** |
| (c) Listas y compartidas | 7 | 16 | 16 |
| (d) Onboarding / Perfil / Compartir | 6 | 11 | 11 |
| Total de las cuatro zonas | 25 | 76 | **81** |

(c) y (d) cierran solas. (a) va +1 y (b) va +4. Sumar esas dos diferencias da las 5 llamadas de más dentro de los 25 archivos. No las quité del conteo para forzar 76: el brief dice localizar por archivo y texto, contar, y si no cuadra, reportar.

De las 81, **38** llevan `variant: "error"` en esa misma llamada (en `ConnectionsClient` la variante de error está en una rama del ternario). El brief parte de **32** errores. Tampoco cuadra, así que no hay tabla de decisión Reintentar / condicional / sin acción sobre «los 32».

## Contrato del toast (leído, sin cambios)

`ToastPayload` en `src/lib/toast.ts` ya tiene `key`, `poster`, `progress`, `persistent`, `action` (`label` + `onClick`), `durationMs` y `updateToast(key, patch)`. No hay un `onAction` aparte de `action.onClick`.

Duraciones por defecto, sin `durationMs` explícito: éxito 4 s, info 5 s, «Deshacer» 7 s, error sin acción 8 s. Un error con acción permanece hasta cerrarlo. El mismo error (mismo título y descripción, sin `key`) reemplaza al anterior. Un éxito repetido con el mismo texto se agrupa y sube `count`.

`showDiaryRemovedToast` (`src/lib/diary-undo.ts`) ya muestra «Quitada de tu diario» con `durationMs: 7000` y Deshacer encadenado al clear. No es una de las 81: vive fuera de los 25 archivos. Los llamadores de la zona (a) lo usan y no duplican ese `showToast`.

## Zona (a) · 18 llamadas (el brief dice 17)

| Archivo | Línea | Título actual | Error |
| --- | ---: | --- | --- |
| `TitleFichaActions.tsx` | 185 | Sale primero en Hoy | |
| `TitleFichaActions.tsx` | 197 | Sale primero en Hoy | |
| `TitleFichaActions.tsx` | 212 | En Quiero ver / Fuera de Quiero ver | |
| `TitleFichaActions.tsx` | 246 | No se puede quitar todavía | sí |
| `TitleFichaActions.tsx` | 272 | No se pudo quitar | sí |
| `TitleFichaActions.tsx` | 283 | Nota guardada | |
| `TitleFichaActions.tsx` | 324 | Guardada en tu lista / Guardada en N listas | |
| `TitleFichaActions.tsx` | 365 | En tu Diario | |
| `FichaWatchedSection.tsx` | 53 | No se pudo quitar | sí |
| `MarkWatchedForm.tsx` | 53 | Diario actualizado / Marcada como vista | |
| `MarkWatchedForm.tsx` | 60 | No se pudo guardar | sí |
| `MarkWatchedForm.tsx` | 79 | No se pudo quitar | sí |
| `MarkWatchedSheet.tsx` | 184 | Diario actualizado / Marcada como vista | |
| `MarkWatchedSheet.tsx` | 211 | No se pudo guardar | sí |
| `SeriesStatusPanel.tsx` | 66 | Estado de serie actualizado / Estado de serie quitado | |
| `SeriesStatusPanel.tsx` | 87 | Estado de serie quitado | |
| `RelinkTitleSheet.tsx` | 126 | Ficha cambiada / Ya era esta | |
| `TitleListsPanel.tsx` | 49 | En la lista / Fuera de la lista | |

Quitar del diario en `TitleFichaActions`, `FichaWatchedSection` y `MarkWatchedForm` pasa por `showDiaryRemovedToast`, no por `showToast` en esos archivos. `TitleFichaActions` además avisa «No se puede quitar todavía» si el guardado de la fecha sigue en vuelo (`PendingSaveError`).

Errores vivos en la zona: 6. El brief nombra «Reintentar» en `FichaWatchedSection` y `MarkWatchedForm`, y ninguno en `MarkWatchedSheet`. No clasifica los dos errores de `TitleFichaActions` (246 y 272). `MarkWatchedForm` tiene dos errores (guardar y quitar); el brief nombra el archivo una sola vez dentro de los 13 seguros.

## Zona (b) · 36 llamadas (el brief dice 32)

| Archivo | Línea | Título actual | Error | `durationMs` |
| --- | ---: | --- | --- | --- |
| `useWatchlistActions.ts` | 56 | Fuera de Quiero ver | | |
| `useWatchlistActions.ts` | 77 | En tu diario | | 6000, Deshacer |
| `useWatchlistActions.ts` | 86 | No se pudo deshacer | sí | |
| `useWatchlistActions.ts` | 102 | Ahora no | | |
| `useWatchlistActions.ts` | 105 | No se pudo guardar | sí | |
| `useWatchlistActions.ts` | 111 | Ya es tu elección de esta noche | | |
| `useWatchlistActions.ts` | 115 | Lista para esta noche | | |
| `useWatchlistActions.ts` | 119 | No se pudo guardar | sí | |
| `useWatchlistActions.ts` | 128 | Ahora es la primera | | |
| `useWatchlistActions.ts` | 137 | Nota guardada / Nota quitada | | |
| `useWatchlistActions.ts` | 140 | No se pudo guardar la nota | sí | |
| `TonightSala.tsx` | 256 | En tu diario | | 6000, Deshacer |
| `TonightSala.tsx` | 266 | No se pudo deshacer | sí | |
| `TonightSala.tsx` | 274 | No se pudo guardar | sí | |
| `TonightSala.tsx` | 287 | No se pudo guardar | sí | |
| `TonightSala.tsx` | 291 | Ahora no | | 6000, Deshacer |
| `TonightSala.tsx` | 302 | No se pudo deshacer | sí | |
| `TonightSala.tsx` | 317 | No se pudo guardar | sí | |
| `TonightSala.tsx` | 321 | No te la volveremos a sugerir | | 6000, Deshacer |
| `TonightSala.tsx` | 330 | No se pudo deshacer | sí | |
| `TonightSala.tsx` | 345 | Ruta para después | | |
| `TonightSala.tsx` | 348 | No se pudo guardar | sí | |
| `TonightSala.tsx` | 355 | Fuera de Quiero ver | | |
| `TonightSala.tsx` | 358 | No se pudo quitar | sí | |
| `useTmdbTitleActions.ts` | 140 | No se pudo guardar | sí | |
| `useTmdbTitleActions.ts` | 150 | En Quiero ver / Marcada como vista (o el toast que devuelva `watchlistToast`) | | el callback de cine mete 6000 |
| `useTmdbTitleActions.ts` | 183 | No se pudo reservar | sí | |
| `useTmdbTitleActions.ts` | 195 | Primera en Hoy esta noche | | 6000, acción «Ver en Hoy» |
| `useTmdbTitleActions.ts` | 241 | No se pudo guardar | sí | |
| `useTmdbTitleActions.ts` | 252 | `listSelectionToast` (En {lista} / En N listas / Fuera de {lista} / Listas actualizadas) | | |
| `useRecoActions.ts` | 77 | No se pudo guardar | sí | |
| `useRecoActions.ts` | 85 | En Quiero ver / Marcada como vista | | |
| `useRecoActions.ts` | 111 | No se pudo reservar | sí | |
| `useRecoActions.ts` | 118 | Primera en Hoy esta noche | | 6000 |
| `WhySheet.tsx` | 52 | Más como esta / Menos como esta | | |
| `WhySheet.tsx` | 64 | No se pudo guardar | sí | |

Errores vivos en la zona: 18. El brief cuenta 3 seguros en `TonightSala`, 4 seguros en `useWatchlistActions`, 3 condicionales en `useTmdbTitleActions`, 2 condicionales en `useRecoActions`, 1 condicional en `TonightSala` (línea vieja 253) y 2 sin acción (`WhySheet` y `TonightSala` línea vieja 276). 3+4+3+2+1+2 = 15. Hay 18.

Los cuatro `durationMs: 6000` que el brief manda quitar siguen, y `TonightSala` tiene tres, no uno. `src/components/cine/CineActions.tsx` no llama a `showToast`; devuelve `durationMs: 6000` dentro del objeto que `useTmdbTitleActions` muestra en la línea 150.

«Ahora no» y «No te la volveremos a sugerir» siguen con el texto actual. El brief los deja sin decidir.

## Zona (c) · 16 llamadas (cuadra con el brief)

| Archivo | Línea | Título actual | Error |
| --- | ---: | --- | --- |
| `AddTitleToListCta.tsx` | 108 | En la lista | |
| `AddTitleToListCta.tsx` | 118 | No se pudo agregar | sí |
| `useListCardMenu.tsx` | 35 | Fuera de la lista | |
| `useListCardMenu.tsx` | 41 | No se pudo quitar | sí |
| `DeleteCollectionButton.tsx` | 95 | `successToast` (prop) | |
| `DeleteCollectionButton.tsx` | 98 | `successToast` (prop) | |
| `YourTopCard.tsx` | 178 | `yourTopLabel` → «Tu top {n} de {año}» | |
| `MembersPanel.tsx` | 89 | `done` (ver abajo) | |
| `MembersPanel.tsx` | 93 | `caught.message` o «No se pudo guardar» | sí |
| `MembersPanel.tsx` | 314 | Saliste de la lista | |
| `MembersPanel.tsx` | 317 | No se pudo salir | sí |
| `RequestControls.tsx` | 36 | Aprobado / Rechazado | |
| `RequestControls.tsx` | 46 | No se pudo guardar | sí |
| `RequestControls.tsx` | 78 | No se pudo guardar | sí |
| `ShareListSheet.tsx` | 101 | `caught.message` o «No se pudo crear el link» | sí |
| `ShareListSheet.tsx` | 129 | Link copiado | |

`DeleteCollectionButton` solo muestra toast si llega `successToast`. El único llamador, `src/app/listas/[id]/editar/page.tsx`, no pasa esa prop. Las dos llamadas están en el fuente y hoy no se ejecutan. Siguen contando como llamadas.

Textos que entran por `MembersPanel` línea 89: «Link apagado», «Link prendido», «Link revocado», «{nombre} ahora puede editar» / «{nombre} ahora solo ve», «{nombre} ya no está en la lista».

`yourTopLabel` (`src/lib/cine-top.ts`) arma «Tu top {n} de {año}». No es «{Sustantivo} {participio}». No se tocó.

Líneas que el brief cita y siguen en el mismo sitio: `MembersPanel` 93 y 317, `RequestControls` 46 y 78. `ShareListSheet` 101 también sigue.

## Zona (d) · 11 llamadas (cuadra con el brief)

| Archivo | Línea | Título actual | Error | `durationMs` |
| --- | ---: | --- | --- | --- |
| `WatchlistStep.tsx` | 94 | No se pudo quitar | sí | |
| `WatchlistStep.tsx` | 124 | No se pudo guardar | sí | |
| `FavoriteStep.tsx` | 61 | No se pudo guardar | sí | |
| `YearStep.tsx` | 106 | No se pudo guardar | sí | |
| `ProfileAccountCard.tsx` | 166 | Nombre guardado / Correo guardado | | |
| `ProfileAccountCard.tsx` | 255 | Contraseña actualizada | | |
| `ShareButton.tsx` | 25 | Enlace copiado | | |
| `ShareButton.tsx` | 27 | No se pudo copiar el enlace | sí | 8000 |
| `ConnectionsClient.tsx` | 43 | {etiqueta} copiado | | |
| `ConnectionsClient.tsx` | 45 | No se pudo copiar. Selecciónalo y cópialo a mano. | sí | |
| `ConnectionsClient.tsx` | 153 | {nombre} desconectada / Token revocado, o «Ya no estaba activa.» si falla | la rama de fallo es error | |

Onboarding no tiene toast de éxito. `WatchlistStep` no muestra «N películas añadidas»; el acierto solo actualiza la cola. Agrupar esa ráfaga sería un toast nuevo, no una de las 11.

«Ya no estaba activa.» sigue en `variant: "error"` (línea 156, dentro de la llamada 153).

## Fuera de los 25 archivos · 17 llamadas

| Archivo | Línea | Título actual | Error |
| --- | ---: | --- | --- |
| `src/lib/diary-undo.ts` | 56 | Quitada de tu diario | | `durationMs` 7000, Deshacer |
| `src/lib/diary-undo.ts` | 65 | No se pudo deshacer | sí |
| `src/components/universo/StartRutaButton.tsx` | 33 | No se pudo empezar | sí |
| `src/components/universo/StartRutaButton.tsx` | 37 | Espera su turno | |
| `src/components/cine/RemindPremiereButton.tsx` | 39 | No se pudo guardar | sí |
| `src/components/onboarding/OnboardingFlow.tsx` | 214 | No se pudo empezar la ruta | sí |
| `src/components/piezas/VisteRitual.tsx` | 83 | No se pudo guardar | sí |
| `src/components/piezas/VisteRitual.tsx` | 87 | No la viste | | `durationMs` 6000, acción «Quiero ver» |
| `src/components/piezas/VisteRitual.tsx` | 103 | En Quiero ver, o «No se pudo guardar» | la rama de fallo es error |
| `src/components/rutas/RutaActions.tsx` | 43 | No se pudo reservar | sí |
| `src/components/rutas/RutaActions.tsx` | 47 | Primera en Hoy esta noche | |
| `src/components/rutas/RutaActions.tsx` | 102 | Ruta para después | |
| `src/components/rutas/RutaActions.tsx` | 105 | De vuelta en Hoy / Hoy ya tiene dos rutas | |
| `src/components/rutas/RutaActions.tsx` | 131 | No se pudo empezar | sí |
| `src/components/rutas/RutaActions.tsx` | 135 | Espera su turno | |
| `src/components/rutas/RutaRevealSheet.tsx` | 46 | No se pudo reservar | sí |
| `src/components/rutas/RutaRevealSheet.tsx` | 51 | Primera en Hoy esta noche | |

El brief no los incluye en las cuatro zonas. No se migran en este PR.

## Errores y la regla de red frente a validación

FIL-I28-1.3 pide una regla concreta y un helper con test para 7 condicionales. No se escribió.

Los resultados que alimentan los condicionales nombrados no traen un discriminante:

- `AddTitleFromTmdbResult` es `{ ok: true; ... } | { ok: false; error: string }` (`src/lib/add-title-from-tmdb.ts`). Lo usan `useTmdbTitleActions` y `useRecoActions`.
- `pinTonightFromSearch` / el pin de ficha devuelven `{ ok: false; error: string }` (`src/app/actions/tonight.ts`).
- `MembersPanel` línea 93 muestra `caught.message`. Las acciones de `src/app/actions/list-sharing.ts` lanzan `Error` con texto («Ese rol no está disponible en esta lista.», «Eres la persona dueña de esta lista.») o fallan por otra causa con el mismo tipo. No hay estado HTTP ni código `validation` / `network` en ese catch.

Un `catch` de `fetch` o un 5xx no aparece en esas llamadas. Inventar la distinción a partir del texto español marcaría como reintentables errores de permiso o de validación. El brief lo prohíbe: si el resultado no se distingue, se deja sin «Reintentar» y se reporta. Aquí ni siquiera se llega a dejarlas sin acción en código, porque el inventario de errores no es el de 32.

## Copy

No hay tabla antes/después de 76 filas. Aplicar «{Sustantivo} {participio}» a 81 llamadas, o a un subconjunto elegido para que sume 76, sería improvisar el alcance. Los títulos vivos están en las tablas de arriba. El copy propuesto del brief queda sin aplicar, pendiente de que el inventario cierre y de la revisión de Jorge (check I28-1.2, humano).

Botones de estado («En tu diario» como etiqueta) no se revisaron: el brief los deja fuera.

## Qué no se hizo

- FIL-I28-2, -3, -4 y -5: ningún archivo de UI.
- Helper de reintento y sus tests.
- Cambio de `durationMs`, póster, `poster` o acciones.
- Capturas a 375 / 390 / 1280. FIL-I28-6 es humano; las capturas del agente eran para las zonas ya migradas.
- `canvas.html` / `canvas.png` no están en este árbol.

## Checks del brief (verbatim) y evidencia de este commit

1. «Tabla de 32 errores entregada a Jorge con archivo:línea, idempotencia y decisión (Reintentar / condicional / sin acción).» No cumple. Hay 38 llamadas con `variant: "error"` en los 25 archivos, más 9 fuera. Este archivo es el inventario, no esa tabla de 32. El check se cierra cuando Jorge reciba una tabla que sí corresponda al código; este commit no lo marca.
2. «Tabla de copy antes/después de las 76 llamadas aprobada por Jorge (incluye «Ahora no» y «No te la volveremos a sugerir»).» Humano. No marcado. La tabla no está porque el conteo no es 76.
3. «Definido cómo se distingue un fallo de red de uno de validación para los 7 condicionales.» No cumple en código. No hay helper. Evidencia: los resultados citados arriba son `error: string` o `Error.message`, sin estado de red.
