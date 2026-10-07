# Filmia

App personal para trackear películas y series vistas. UI en español, estética Letterboxd casera. Persistencia con Drizzle + Neon (Postgres). Cada usuario tiene su propio diario, listas y watchlist.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Auth liviana: JWT (`jose`) + cookie httpOnly + PBKDF2 (Web Crypto)
- Drizzle ORM + Neon serverless HTTP (`@neondatabase/serverless`)
- Postgres en Neon (proyecto `filmia`)
- **Producción prevista**: Vercel (sin deploy configurado; no publicar desde esta rama)

## Ramas

| Rama | Uso |
| --- | --- |
| `sandbox` | Integración. Aquí aterrizan los PRs. |
| `main` | Rama por defecto de GitHub. No abrir features contra `main`. |
| `jl/<descripción>-xxxx` | Feature de vida corta. Se borra al mergear el PR. |

Flujo:

1. Parte de `sandbox`: `git checkout sandbox && git pull origin sandbox`
2. Crea `jl/<qué-hace>-xxxx` y abre el PR **hacia `sandbox`**
3. Tras el merge, borra la rama remota (GitHub no lo hace solo):

```bash
git push origin --delete jl/nombre-de-la-rama
git fetch --prune
```

`main` y `sandbox` se conservan. No dejes ramas `jl/` huérfanas: GitHub las lista aunque el PR ya esté cerrado o mergeado.

## Hoy · Esta noche

La pestaña de inicio es **Hoy**: un mazo («Esta noche») con lo que vale la pena ver de Quiero ver para la noche que queda, no la lista entera.

- **Lentes**: «Para ti» (score personal) y después tus tres géneros con más afinidad. Cada título vive en una sola lente.
- **Score** (`src/lib/tonight/`): filtro duro (incluida en tus plataformas, no vista, sin «Ahora no» reciente) → perfil de gusto (géneros, keywords, director, reparto, década e idioma, ponderados por tu nota menos tu media con decaimiento de 18 meses) → `0,30·gusto + 0,20·calidad (IMDb bayesiano con votos) + 0,20·encaje con la noche + 0,15·impulso (serie en curso, Por rewatch, tu nota, tu orden) + 0,10·novedad + 0,05·reposo`, × fatiga por impresiones → MMR (λ 0,65, máximo 2 por género) + comodín → dos razones en español por carta.
- **Encaje con la hora** se calcula en el cliente con la hora local y tu «hora de dormir» (Perfil → Esta noche): «acaba 23:19» o «se pasa 14 min».
- **Precálculo**: `TonightPick` se escribe en el cron `/api/cron/tonight-picks` (09:30 UTC) y con `after()` tras cada «Vi esto», alta/baja en Quiero ver, nota, lista o plataforma. La petición de `/` lee una consulta indexada; si no hay cálculo o tiene más de un día, calcula en línea y persiste después de responder.
- **Aprende**: `PickEvent` guarda impresiones, saltos, «Ahora no» (oculta 14 días), aperturas y «Más así / Menos así».
- **Gestos**: arrastra (o toca) el **talón** bajo el póster para «Vi esto»; mantén pulsado el póster para Ver ficha · Ahora no · Mover · Quitar.
- **Tu diario** (calendario, mazo, cuadrícula) vive en Perfil y en `/diario`; `/?mode=historial` redirige.

Para rellenar keywords, créditos, votos IMDb y color ambiente en títulos existentes y precalcular los mazos:

```bash
npm run db:backfill-tonight
```

## Modelo

- **User**: cuenta con email, contraseña hasheada opcional (PBKDF2; hashes bcrypt legacy se verifican al entrar; `null` si solo entra con Google), `googleId` opcional, nombre opcional y `streamingPlatforms` (JSON: claves del enum `Platform`)
- **Catalog**: una fila por película o serie, compartida por todos los usuarios y única por `(tmdbId, kind)`: nombre, año, poster (TMDB), sinopsis, rating IMDb + votos + premios (OMDb), keywords y personas (TMDB), disponibilidad MX, color ambiente. Se llena una sola vez al guardar el título por primera vez (`src/lib/catalog-enrich.ts`); los usuarios nunca la editan
- **Title**: la entrada personal de un usuario para una ficha del catálogo (`catalogId`): nota 1–10, comentario, «Dónde la vi», fecha vista, estado de serie. No se borra; solo cambian sus campos personales. La app lee siempre el tipo plano `Title` (`flattenTitle` en `src/lib/catalog-core.ts`), que es la fila personal con el catálogo encima
  - Migraciones del split: 0009 (aditiva) crea `Catalog` y enlaza cada `Title`; 0010 (destructiva) borra de `Title` las columnas de metadatos heredadas y exige `catalogId` único por usuario. 0010 se aplica solo después de desplegar este código (ver la cabecera de `drizzle/0010_catalog_cutover.sql`)
- **TonightPick** + **PickEvent**: mazos precalculados de «Esta noche» por usuario y su retroalimentación (ver [Hoy · Esta noche](#hoy--esta-noche))
- **List** + **ListItem**: listas y membresía por usuario (Quiero ver, Favoritas, Por rewatch + personalizadas)
- **Platform** (enum): Netflix, Prime, Max, Disney+, Claro, Apple, Mubi y otras de JustWatch MX

El schema vive en `src/db/schema.ts`. El client Drizzle está en `src/db/index.ts`.

## Requisitos

- Node.js 20+
- Una `DATABASE_URL` de Neon (pooled, hostname con `-pooler`)
- Una `DATABASE_URL_UNPOOLED` (directa, sin `-pooler`) para `drizzle-kit migrate`
- `AUTH_SECRET` (JWT de sesión). Genera uno con `openssl rand -base64 32`
- `TMDB_API_KEY` (gratis) para posters
- `OMDB_API_KEY` (gratis, 1000 req/día) para ratings IMDb

## Arranque local

```bash
cp .env.example .env
# Pega las URLs del proyecto Neon `filmia` y AUTH_SECRET (nunca commitees .env)

npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Las rutas de la app requieren sesión; `/login` y `/registro` están abiertas.

### Auth

- **Registro**: `/registro` — email, contraseña (mín. 8 caracteres), nombre opcional
- **Login**: `/login` — email + contraseña; la sesión es un JWT en cookie httpOnly (`filmia.session-token`)
- **Google**: botón «Continuar con Google» en `/login` y `/registro` (OAuth 2.0 + PKCE, sin librerías extra ni coste). Aparece solo si `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` están definidas. Si el correo de Google ya tiene cuenta, se enlaza automáticamente; si no, se crea una cuenta **sin contraseña** (en Perfil no sale el bloque de contraseña). Ver [Acceso con Google](#acceso-con-google).
- **Logout**: botón «Salir» en la cabecera
- **Perfil**: `/perfil` — plataformas de streaming contratadas (México)
- Rutas protegidas redirigen a `/login` si no hay sesión (proxy + comprobaciones en servidor)

Usuario demo del seed (datos dummy):

- Email: `demo@filmia.local`
- Contraseña: `filmia-demo`

Variables de entorno:

| Variable | Uso |
| --- | --- |
| `AUTH_SECRET` | Firma del JWT de sesión (obligatoria) |
| `NEXTAUTH_SECRET` | Alias de compatibilidad de `AUTH_SECRET` |
| `AUTH_URL` | URL pública de la app. Local: `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | ID de cliente OAuth de Google (opcional; activa el botón de Google) |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth de Google (opcional) |

### Acceso con Google

Gratis: Google no cobra por «Iniciar sesión con Google» y, con los scopes `openid email profile`, no hace falta pasar verificación de la app.

1. [console.cloud.google.com](https://console.cloud.google.com) → crea un proyecto (p. ej. `filmia`).
2. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo *Externo*, nombre «Filmia», tu correo de soporte. Publica la app (*In production*); con scopes no sensibles no requiere revisión.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**, tipo *Aplicación web*:
   - Orígenes autorizados: `http://localhost:3000` y la URL de producción.
   - URIs de redirección autorizadas: `http://localhost:3000/api/auth/google/callback` y `https://<dominio>/api/auth/google/callback`.
4. Copia el ID y el secreto a `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) y a Vercel.
5. `AUTH_URL` debe coincidir con el origen que registraste (`http://localhost:3000` en local): el callback se construye a partir de ella. Abre la app en ese mismo origen, no en `127.0.0.1`.

Flujo: `GET /api/auth/google` guarda `state` + verificador PKCE en una cookie de 10 min y redirige a Google; `GET /api/auth/google/callback` valida el `state`, cambia el código por el `id_token`, lo verifica contra las claves públicas de Google (`jose`) y emite la misma cookie de sesión que el login con contraseña. Una cuenta de Google sin contraseña no puede entrar por `/login` con correo (mensaje explícito); una cuenta con contraseña que entra con Google queda enlazada y conserva ambas vías.

Pendiente de probar en la PWA de iOS (pantalla de inicio): el salto a `accounts.google.com` abre una hoja de navegador y hay que confirmar que la cookie de sesión vuelve a la app.

### Premios (OMDb) — chip «Premiadas» en Quiero ver

`Title.awards` guarda la frase `Awards` de OMDb («Won 2 Oscars. 23 wins & 12 nominations total») tal cual; `src/lib/awards.ts` la convierte en el chip corto («2 Óscar», «Nominada al Óscar», «7 premios»). Llega sola al agregar títulos (misma llamada que la nota IMDb). Para el catálogo existente, tras `npm run db:migrate` (0006):

```bash
npm run db:backfill-awards -- --dry-run   # solo reporta
npm run db:backfill-awards                # una llamada OMDb por título con imdbId; el plan gratuito permite 1 000/día
```

### Migraciones (Drizzle)

El journal en `drizzle/` es la fuente de verdad. Neon prod ya tiene `0000_baseline` + `0001_add_title_overview`. **No re-apliques SQL histórico de Prisma.**

Para generar SQL a partir de `src/db/schema.ts` (solo cuando el schema cambie):

```bash
npm run db:generate
# equivale a: drizzle-kit generate
```

Para aplicar migraciones pendientes (local o un entorno existente):

```bash
npm run db:migrate
# equivale a: drizzle-kit migrate
```

`drizzle.config.ts` usa `DATABASE_URL_UNPOOLED` (o `DATABASE_URL` si no hay unpooled). Las migraciones necesitan la URL directa. La app Next.js usa `DATABASE_URL` (pooled) vía el driver Neon serverless HTTP.

`0000_baseline` es un no-op a propósito: el esquema ya existía en Neon. Los cambios nuevos van en `0001_…` en adelante.

### JOR-152 — plataformas de streaming del usuario

Columna `User.streamingPlatforms` (`JSONB NOT NULL DEFAULT '[]'`): array de claves del enum `Platform` (`NETFLIX`, `PRIME`, `MAX`, `DISNEY`, `CLARO`, `APPLE`, `MUBI`, …).

En un checkout nuevo, `npm run db:migrate` deja el journal de Drizzle al día. No hace falta seed ni backfill: prefs vacías son válidas. `/perfil` y «dónde ver» muestran el CTA «Elige tus plataformas».

El filtro de biblioteca (JOR-157) lee este JSON y `watchProvidersMx` con `titleAvailableOnUserPlatforms` / `applyMinePlatformsFilter`. Toggle `?minePlatforms=1` en diario, Quiero ver y listas. Solo cuenta **flatrate** (incluido en suscripción); rent/buy no. Títulos sin cache de providers se excluyen y se anota «sin datos de streaming». Si no hay prefs, CTA a `/perfil`.

### Seed

Datos dummy (no personales): Gladiator, Troy, Athena (2022), The Northman, Mad Max: Fury Road, Tron: Legacy, Dune: Part Two. Listas: Épicas, Visto recientemente, Vibe Mad Max / Tron. Asignados al usuario demo.

```bash
npm run db:seed
```

El seed es idempotente por nombre + año dentro de cada usuario.

### Backfill de posters e IMDb

Para fichas del catálogo incompletas (sin poster, sin IMDb id o sin sinopsis; p. ej. después del seed):

```bash
# Requiere TMDB_API_KEY (+ OMDB_API_KEY recomendada) en .env
npm run db:backfill-metadata

# Re-enriquecer todas las fichas, aunque ya estén completas
npm run db:backfill-metadata -- --force
```

Corre el mismo enriquecimiento que ocurre al guardar un título (detalles, créditos, keywords, rating y premios, disponibilidad MX, color ambiente), una vez por película del catálogo compartido.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción Next.js (Node) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests `node:test` vía tsx (`src/lib/*.test.ts`) |
| `npm run verify` | Verifiers offline (sin DB) |
| `npm run ci` | lint + typecheck + test + verify |
| `npm run db:generate` | Genera SQL de Drizzle desde `src/db/schema.ts` |
| `npm run db:migrate` | Aplica el journal de Drizzle (`drizzle-kit migrate`) — **fuera** de `next build` |
| `npm run db:migrate:deploy` | Alias explícito de `db:migrate` (mismo comando; no corre en Vercel build) |
| `npm run db:push` | Empuja el schema a la DB sin archivo de migración (dev) |
| `npm run db:seed` | Carga títulos dummy + usuario demo |
| `npm run db:backfill-metadata` | Enriquece fichas del catálogo incompletas (TMDB + OMDb), una vez por película |
| `npm run db:backfill-tonight` | Keywords, créditos, votos IMDb y color ambiente + precálculo de «Esta noche» |
| `npm run db:set-password` | Rehash PBKDF2 para un email: `-- <email> <password>` |
| `npm run db:studio` | Drizzle Studio |

## Despliegue (Vercel, apagado)

El runtime es Next.js en **Node**. El host previsto es Vercel; **Git auto-deploy y preview están apagados** (`vercel.json`). No publiques este trabajo a producción desde PRs de sandbox.

Playbook canónico (env **names** only, migrate fuera de `next build`, cómo encender preview más tarde sin shippear prod): [`docs/vercel-playbook.md`](docs/vercel-playbook.md) — [JOR-213](https://linear.app/jorg3l3on/issue/JOR-213) bajo [JOR-209](https://linear.app/jorg3l3on/issue/JOR-209).

Resumen rápido:

1. Variables en Vercel (nombres): `DATABASE_URL` (pooled), `AUTH_SECRET`, `TMDB_API_KEY`, `OMDB_API_KEY`; `AUTH_URL` opcional; `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` si quieres el botón de Google. Nunca secretos reales en el repo — ver `.env.example`.
2. Migraciones: `npm run db:migrate` con `DATABASE_URL_UNPOOLED` **fuera** del build de Vercel / CI Next.
3. Preview: opcional y documentado en el playbook; hoy blocked (`ignoreCommand` + Git off). Preferencia al publicar: prod-only.

Posters TMDB: `next.config.ts` → `images.remotePatterns`.

## Notas para Taller

- El schema está en `src/db/schema.ts`. Las migraciones van en `drizzle/` (`0000_baseline`, `0001_add_title_overview`, …). Aplícalas con `DATABASE_URL` / `DATABASE_URL_UNPOOLED` del proyecto Neon `filmia` (`late-cell-10415663`).
- Neon prod ya tiene el journal de Drizzle. No re-ejecutes SQL viejo de Prisma.
- Si la VM no tiene `DATABASE_URL`, apunta Drizzle a Neon y corre `npm run db:migrate`.
- No hay secretos en el repo. Solo `.env.example`.
- Host previsto: Vercel. Git deploys + preview apagados (`vercel.json`); playbook: `docs/vercel-playbook.md` (JOR-213).

Ticket scaffold: [JOR-149](https://linear.app/jorg3l3on/issue/JOR-149/scaffold-next-prismaneon-crud-titulos).
