# data/

## cines-mx.json — estrenos de cine mexicano (Cine, FIL-I17-2)

TMDB acierta poco con las fechas de estreno comercial del cine mexicano (27–36 %), así que el
cron de Cine (`/api/cron/cine`, paso `imcine`) aplica este archivo encima de lo que trae TMDB:
una fecha de aquí (`source: "imcine"`) gana siempre sobre la de TMDB, y si TMDB no tenía la
película como estreno comercial, el paso la crea igual.

### Actualizarlo cada mes

1. Al inicio de cada mes IMCINE publica la nota «Estrenos de {mes}» en
   <https://www.imcine.gob.mx/> (Noticias; p. ej. `nota.php?id=404` para octubre de 2026).
2. Por cada película: busca su `tmdbId` en themoviedb.org (la URL `/movie/<id>`). Si no está en
   TMDB, déjala con `"tmdbId": null` y una `note`: el paso la reporta y la salta.
3. Coteja la fecha con la prensa de cartelera (Milenio, Informador, cinepremiere) y, ya
   estrenada, con la taquilla de fin de semana de Canacine (<https://canacine.org.mx/>). Si
   difieren, gana la cadena/distribuidora y anótalo en `note`.
4. Agrega la nota a `sources`, actualiza `updatedAt` y abre el PR. Las entradas viejas se pueden
   quedar: una película estrenada sigue su curso (`now` → `gone`).

Formato de cada entrada (validado con zod al correr el paso; una entrada inválida se reporta y
no detiene las demás):

```json
{ "tmdbId": 1406492, "title": "La venganza del Charro Negro", "mxReleaseDate": "2026-10-22", "source": "imcine", "note": "opcional" }
```
