# Auditoría FIL-I28 · 98 llamadas de `showToast`

HEAD de partida `8c4c0ee`. El brief contaba 76 en 25 archivos con líneas de antes de FIL-I27/I29. El alcance real, confirmado en ese HEAD, es **cada `showToast(` de producción: 98 llamadas en 32 archivos**. Fuera de la cuenta: `src/lib/toast.test.ts` y el banco `src/components/toast/ToastBench.tsx` (6, solo desarrollo).

Los 7 archivos que el brief no listaba quedan en la zona más afín. El copy es provisional hasta que Jorge lo apruebe. No se tocan «Ahora no» ni «No te la volveremos a sugerir». No se cambia el contrato de `src/lib/toast.ts`.

## Zonas

| Zona | Archivos | Llamadas | De más, asignados aquí |
| --- | ---: | ---: | --- |
| (a) Diario / Ficha | 8 | 20 | `src/lib/diary-undo.ts` (el Deshacer de «Quitada de tu diario») |
| (b) Hoy / Quiero ver | 10 | 50 | `VisteRitual` (¿Las viste?), `StartRutaButton`, `RemindPremiereButton` (estreno → Quiero ver), `RutaActions`, `RutaRevealSheet` |
| (c) Listas y compartidas | 7 | 16 | — |
| (d) Onboarding / Perfil / Compartir | 7 | 12 | `OnboardingFlow` (empezar la ruta al cerrar el alta) |
| Total | 32 | 98 | |

`CineActions` no llama a `showToast`. Mete `durationMs: 6000` en el objeto que `useTmdbTitleActions` muestra: se quita ahí, en la zona (b).

## Regla de «Reintentar»

1. **Seguro.** La operación es idempotente (repetirla deja el mismo estado) y el fallo es un rechazo (`catch`), no un resultado de negocio. El botón re-aplica el estado optimista que el fallo revirtió, ejecuta la operación **una vez** y, si vuelve a fallar, muestra el error sin botón.
2. **Condicional.** Solo si el fallo es de red de verdad: `TypeError` de `fetch` (`Failed to fetch`, `Load failed`) o `DOMException` `NetworkError`. Un `Error` con mensaje de permiso o validación no lo es.
3. **Sin acción.** No idempotente, el aviso ya está en la hoja, o el resultado es `{ ok: false, error: string }` **sin** código de estado. No se inventa la distinción leyendo el texto.

Un error con «Reintentar» permanece hasta cerrarlo (lo hace el store). Sin acción, el error dura 8 s. El mismo error reemplaza al anterior. «Deshacer» dura 7 s por defecto: se quitan los `durationMs: 6000`. `diary-undo` conserva `durationMs: 7000`.

`ShareButton` pierde el `durationMs: 8000`. Un error sin acción ya dura 8 s. No se deja persistente: la URL sigue en el subtítulo para copiarla a mano, y a los 8 s el aviso se va.

### Sin «Reintentar» porque no hay forma de distinguir (reportado)

Estas acciones devuelven `{ ok: false, error: string }` o solo entregan ese texto. No hay estado HTTP ni `code`. Quedan sin botón:

| Llamada | Por qué no se distingue |
| --- | --- |
| `useTmdbTitleActions` 140, 183, 241 | `AddTitleFromTmdbResult` / pin / listas: `{ ok: false, error: string }` |
| `useRecoActions` 77, 111 | el mismo resultado |
| `TonightSala` `onWatchError` (274) | llega un `string` ya armado; la operación y el formulario no están en ese callback |
| `VisteRitual` 83 y 103 | `outcome.ok` / `saved.ok` con `error: string` |
| `RemindPremiereButton` 39 | `outcome.error` |
| `StartRutaButton` 33, `OnboardingFlow` 214, `RutaActions` 131 | `outcome.error` al empezar una ruta (además, empezar no es idempotente) |
| `RutaActions` 43, `RutaRevealSheet` 46 | `outcome.error` al reservar |

`MembersPanel` 93 sí se distingue: un `TypeError` de `fetch` ofrece «Reintentar»; `new Error("Ese rol no está disponible…")` o «Eres la persona dueña…» no. El helper es `isNetworkFailure` / `showMaybeNetworkError` en `src/lib/toast-alerts.ts`, con test.

### Errores con «Reintentar» seguro

| Dónde | Operación | Al fallar el reintento |
| --- | --- | --- |
| `FichaWatchedSection` | `clearTitleWatched` | revierte `hidden` |
| `MarkWatchedForm` guardar | `markTitleWatched` | deja el error en la hoja |
| `MarkWatchedForm` quitar | `clearTitleWatched` | el Deshacer ya se retira si el clear falla |
| `TitleFichaActions` 272 | `clearTitleWatched` | revierte el hold del diario |
| `diary-undo` | `restore` del Deshacer | `onUndoFailed` |
| `useWatchlistActions` deshacer, ahora no, fijar, nota | `undoMarkWatched`, `markNotTonight`, `pinTonight`, `updateWatchlistNote` | revierte snooze, pin, nota o la ficha |
| `TonightSala` deshacer visto, ahora no, quitar de Quiero ver, deshacer el ahora no, aparcar ruta | las acciones homónimas | revierten `hide` / ids |
| `AddTitleToListCta` | alta en la lista | `markAdded(false)` y reabre |
| `useListCardMenu` | `removeTitleFromList` | `onRestore` |
| `MembersPanel` 317 | `leaveList` | sin botón la segunda vez |
| `RequestControls` 46 | `decideRequests` | sin botón la segunda vez |

Sin botón, a propósito: `MarkWatchedSheet` (la hoja muestra el error; en el mazo de Hoy el toast lo pone `onWatchError`, así que la hoja no lo repite), `WhySheet`, `TonightSala` «No me interesa» y su Deshacer (la señal de gusto no es idempotente), `TitleFichaActions` «No se puede quitar todavía» (aún no hay fila que borrar), onboarding ×4, `OnboardingFlow`, `ShareButton`, `ConnectionsClient` copiar, `ShareListSheet`, `RequestControls` 78.

`ConnectionsClient` «Ya no estaba activa.» pasa a **info**, con el mismo texto.

## Copy

Póster `tmdbPosterUrl(posterPath, "w185")` en cada aviso de película o serie. Sin path, el icono de la variante. Otra cosa (lista, enlace, persona, ruta, cuenta) no lleva póster y concuerda con su sustantivo.

| Antes | Después | Concordancia |
| --- | --- | --- |
| En tu diario / En tu Diario | Añadida a tu diario | película / serie |
| Quitada de tu diario | igual (FIL-I29, Deshacer 7 s) | película / serie |
| En Quiero ver | Añadida a Quiero ver | película / serie |
| Fuera de Quiero ver | Quitada de Quiero ver | película / serie |
| En la lista / Fuera de la lista | Añadida a la lista / Quitada de la lista | película / serie |
| Guardada en tu lista / Guardada en N listas | Añadida a tu lista / Añadidas a N listas | película / serie |
| En {lista} / Fuera de {lista} / En N listas | Añadida a {lista} / Quitada de {lista} / Añadidas a N listas | el participio va con la película, no con el nombre de la lista |
| Listas actualizadas | igual | listas |
| Marcada como vista, Diario actualizado, Nota guardada, Nota quitada, Estado de serie actualizado, Estado de serie quitado | igual | ya cumplen |
| Sale primero en Hoy, Primera en Hoy esta noche, Lista para esta noche | Reservada para esta noche | película / serie |
| Ya es tu elección de esta noche | Elección confirmada | elección |
| Ahora es la primera | Movida al principio | película / serie |
| Ficha cambiada / Ya era esta | Ficha actualizada / Ficha confirmada | ficha |
| No la viste | Marcada como no vista | película / serie |
| Más como esta / Menos como esta | Afinidad anotada / Distancia anotada | afinidad / distancia |
| Ruta para después | Ruta aplazada | ruta |
| De vuelta en Hoy | Ruta reactivada | ruta |
| Espera su turno | Ruta en espera | ruta |
| Hoy ya tiene dos rutas | Ruta no activada | ruta |
| Tu top N de AÑO (toast) | Top guardado | top. `yourTopLabel` sigue siendo el título de la tarjeta |
| (borrar lista, hoy no hay texto) | Lista eliminada | lista. El llamador pasa `successToast` |
| Aprobado / Rechazado | Solicitud aprobada / Solicitud rechazada | solicitud |
| Link copiado / revocado / apagado / prendido | Enlace copiado / revocado / apagado / activado | enlace |
| {nombre} desconectada | Conexión cerrada | conexión (no adivina el género del nombre) |
| Token revocado, Nombre guardado, Correo guardado, Contraseña actualizada, Enlace copiado | igual | ya concuerdan |
| Saliste de la lista | Salida confirmada | salida |
| Ahora no, No te la volveremos a sugerir | **sin cambio** | — |
| Ya no estaba activa. | el mismo texto, variante info | — |
| No se pudo {verbo} | igual, y subtítulo «Puedes volver a intentarlo.» si hay botón | — |
| Título = mensaje del servidor (`MembersPanel` 93, `ShareListSheet` 101) | título fijo «No se pudo…» y el mensaje en el subtítulo | — |

`WatchlistStep` no tenía aviso de acierto. Cada alta usa el mismo título «Añadida a Quiero ver» (sin subtítulo) para que el store las agrupe y muestre la cuenta. Cada baja, «Quitada de Quiero ver».

Los botones de estado («En tu diario», «En Quiero ver» como etiqueta) no son toasts y no se tocan.

## Checks

1. Tabla de errores con archivo, operación, idempotencia y decisión: este documento, sobre las llamadas vivas (no sobre las 32 del brief). El check humano es que Jorge la reciba.
2. Tabla de copy antes/después: arriba. La aprobación de Jorge no se marca.
3. Regla red/validación: `isNetworkFailure` + `showMaybeNetworkError`, con test. Los `{ ok: false, error: string }` quedan sin «Reintentar» y están listados arriba.
