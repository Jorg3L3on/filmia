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

## Modelo

- **User**: cuenta con email, contraseña hasheada (PBKDF2; hashes bcrypt legacy se verifican al entrar), nombre opcional y `streamingPlatforms` (JSON: claves del enum `Platform`)
- **Title**: película o serie del usuario, nota personal 1–10, poster (TMDB), rating IMDb (OMDb), plataforma opcional, notas, fecha vista
- **Tag** + **TitleTag**: categorías libres por usuario (épica/guerra, visual/espectáculo, etc.). El filtro de diario y listas combina varias etiquetas con **OR**. Ranking en `/tags/[slug]`.
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

El filtro de biblioteca (JOR-157) lee este JSON y `watchProvidersMx` con `titleAvailableOnUserPlatforms` / `applyMinePlatformsFilter`. Toggle `?minePlatforms=1` en diario, Quiero ver, listas y ranking de tags. Solo cuenta **flatrate** (incluido en suscripción); rent/buy no. Títulos sin cache de providers se excluyen y se anota «sin datos de streaming». Si no hay prefs, CTA a `/perfil`.

### Seed

Datos dummy (no personales): Gladiator, Troy, Athena (2022), The Northman, Mad Max: Fury Road, Tron: Legacy, Dune: Part Two. Listas: Épicas, Visto recientemente, Vibe Mad Max / Tron. Asignados al usuario demo.

```bash
npm run db:seed
```

El seed es idempotente por nombre + año dentro de cada usuario. También crea etiquetas sugeridas (`Épica / guerra`, `Visual / espectáculo`, `Vibe Mad Max`, `Vibe Tron`, etc.).

### Etiquetas (JOR-156)

Cada usuario tiene tags propios (`userId` + `slug` únicos). Al entrar o registrarse, `ensureDefaultTags` siembra las sugeridas. Se pueden crear más desde `/tags` o desde la ficha de un título.

- Filtro en diario (`/`) y listas: una o varias etiquetas, combinadas con **OR** (`?tag=epica-guerra&tag=sci-fi`), más `?minePlatforms=1` para lo incluido en tus suscripciones.
- Ranking: `/tags` índice y `/tags/[slug]` ordenable por nota o fecha vista.
- Pastillas rápidas en la ficha para asignar/quitar sin pasar por editar.

### Backfill de posters e IMDb

Para títulos ya existentes sin metadata (p. ej. después del seed):

```bash
# Requiere TMDB_API_KEY (+ OMDB_API_KEY recomendada) en .env
npm run db:backfill-metadata

# Re-enriquecer todos, aunque ya tengan poster
npm run db:backfill-metadata -- --force
```

Busca en TMDB por nombre + año + tipo, guarda poster e IMDb rating vía OMDb.

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
| `npm run db:migrate` | Aplica el journal de Drizzle (`drizzle-kit migrate`) |
| `npm run db:push` | Empuja el schema a la DB sin archivo de migración (dev) |
| `npm run db:seed` | Carga títulos dummy + usuario demo |
| `npm run db:import-watchlist` | Importa `scripts/data/watchlist-queue.json` a Quiero ver |
| `npm run db:backfill-metadata` | Posters TMDB + rating IMDb para títulos existentes |
| `npm run db:set-password` | Rehash PBKDF2 para un email: `-- <email> <password>` |
| `npm run db:studio` | Drizzle Studio |

## Despliegue (Vercel, apagado)

El runtime es Next.js en **Node**. El host previsto es Vercel; **no hay auto-deploy ahora**. No publiques este trabajo a Vercel.

Playbook cuando se vuelva a publicar (sin product feature flags):

1. Secretos en Vercel → Settings → Environment Variables: `DATABASE_URL` (pooled), `AUTH_SECRET`, `TMDB_API_KEY`, `OMDB_API_KEY`. `AUTH_URL` se puede fijar; en Vercel a menudo se infiere.
2. Migraciones contra Neon **fuera** del `next build` de Vercel (local o un pipeline). El build no debe correr `db:migrate`.

```bash
export DATABASE_URL_UNPOOLED="postgresql://..."  # URL directa (sin -pooler)
npm run db:migrate
```

Al pegar `DATABASE_URL`, usa **solo** la URL (`postgresql://…`) sin comillas ni saltos de línea. El sanitizado en `src/lib/database-url.ts` recorta comillas/BOM; si la URL es inválida, el login muestra error de infra (no “contraseña incorrecta”).

Posters TMDB: `next.config.ts` → `images.remotePatterns`.

## Notas para Taller

- El schema está en `src/db/schema.ts`. Las migraciones van en `drizzle/` (`0000_baseline`, `0001_add_title_overview`, …). Aplícalas con `DATABASE_URL` / `DATABASE_URL_UNPOOLED` del proyecto Neon `filmia` (`late-cell-10415663`).
- Neon prod ya tiene el journal de Drizzle. No re-ejecutes SQL viejo de Prisma.
- Si la VM no tiene `DATABASE_URL`, apunta Drizzle a Neon y corre `npm run db:migrate`.
- No hay secretos en el repo. Solo `.env.example`.
- Host previsto: Vercel. Git deploys siguen apagados hasta que se decida publicar.

Ticket scaffold: [JOR-149](https://linear.app/jorg3l3on/issue/JOR-149/scaffold-next-prismaneon-crud-titulos).
