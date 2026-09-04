# Filmia

App personal para trackear películas y series vistas. UI en español, estética Letterboxd casera. Persistencia real con Prisma + Neon (Postgres). Cada usuario tiene su propio diario, listas y watchlist.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Auth.js v5 (`next-auth`) con credenciales (email + contraseña, JWT)
- Prisma 7 + adaptador Neon (`@prisma/adapter-neon` + `@neondatabase/serverless`)
- Postgres en Neon (proyecto `filmia`)
- **Producción**: Cloudflare Workers vía [OpenNext](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`)
- Vercel (`vercel.json`) queda como respaldo opcional desactivado

## Ramas

| Rama | Uso |
| --- | --- |
| `sandbox` | Integración. Aquí aterrizan los PRs y se despliega Cloudflare. |
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

- **User**: cuenta con email, contraseña hasheada (bcrypt), nombre opcional y `streamingPlatforms` (JSON: claves del enum `Platform`)
- **Title**: película o serie del usuario, nota personal 1–10, poster (TMDB), rating IMDb (OMDb), plataforma opcional, notas, fecha vista
- **Tag** + **TitleTag**: categorías libres por usuario (épica/guerra, visual/espectáculo, etc.). El filtro de diario y listas combina varias etiquetas con **OR**. Ranking en `/tags/[slug]`.
- **List** + **ListItem**: listas y membresía por usuario (Quiero ver, Favoritas, Por rewatch + personalizadas)
- **Platform** (enum): Netflix, Prime, Max, Disney+, Claro, Apple, Mubi

## Requisitos

- Node.js 20+
- Una `DATABASE_URL` de Neon (pooled, hostname con `-pooler`)
- Una `DATABASE_URL_UNPOOLED` (directa, sin `-pooler`) para migraciones
- `AUTH_SECRET` (JWT de sesión). Genera uno con `openssl rand -base64 32`
- `TMDB_API_KEY` (gratis) para posters
- `OMDB_API_KEY` (gratis, 1000 req/día) para ratings IMDb

## Arranque local

```bash
cp .env.example .env
# Pega las URLs del proyecto Neon `filmia` y AUTH_SECRET (nunca commitees .env)

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Las rutas de la app requieren sesión; `/login` y `/registro` están abiertas.

### Auth

- **Registro**: `/registro` — email, contraseña (mín. 8 caracteres), nombre opcional
- **Login**: `/login` — credenciales vía Auth.js
- **Logout**: botón «Salir» en la cabecera
- **Perfil**: `/perfil` — plataformas de streaming contratadas (México)
- Rutas protegidas redirigen a `/login` si no hay sesión (proxy + comprobaciones en servidor)

Usuario demo del seed (datos dummy):

- Email: `demo@filmia.local`
- Contraseña: `filmia-demo`

Variables de entorno:

| Variable | Uso |
| --- | --- |
| `AUTH_SECRET` | Firma de JWT (obligatoria) |
| `NEXTAUTH_SECRET` | Alias aceptado por Auth.js |
| `AUTH_URL` / `NEXTAUTH_URL` | URL pública de la app. Local: `http://localhost:3000`. **Obligatoria en Cloudflare Workers** |

### Migraciones en desarrollo

Para crear una migración nueva a partir de `prisma/schema.prisma`:

```bash
npm run db:migrate
# equivale a: npx prisma migrate dev
```

En un entorno ya existente (Taller / prod):

```bash
npx prisma migrate deploy
npm run db:seed
```

`prisma.config.ts` lee `DATABASE_URL_UNPOOLED` de forma lazy (sin `env()`), así `prisma generate` / `postinstall` no exige secretos. Migraciones sí necesitan esa URL. La app Next.js usa `DATABASE_URL` (pooled) vía el adaptador Neon serverless.

**Cloudflare Workers**: el runtime usa `DATABASE_URL` (pooled). Las migraciones **no** corren dentro del Worker; aplícalas desde CI o local con `DATABASE_URL_UNPOOLED` (ver [Despliegue en Cloudflare](#despliegue-en-cloudflare)).

### JOR-152 — plataformas de streaming del usuario

Nueva columna `User.streamingPlatforms` (`JSONB NOT NULL DEFAULT '[]'`): array de claves del enum `Platform` (`NETFLIX`, `PRIME`, `MAX`, `DISNEY`, `CLARO`, `APPLE`, `MUBI`).

En Neon (proyecto `filmia`, `late-cell-10415663`):

```bash
npx prisma migrate deploy
```

No hace falta seed ni backfill: prefs vacías son válidas. `/perfil` y «dónde ver» muestran el CTA «Elige tus plataformas».

El filtro de biblioteca (JOR-157) lee este JSON y `watchProvidersMx` con `titleAvailableOnUserPlatforms` / `applyMinePlatformsFilter`. Toggle `?minePlatforms=1` en diario, Quiero ver, listas y ranking de tags. Solo cuenta **flatrate** (incluido en suscripción); rent/buy no. Títulos sin cache de providers se excluyen y se anota «sin datos de streaming». Si no hay prefs, CTA a `/perfil`.

### Seed

Datos dummy (no personales): Gladiator, Troy, Athena (2022), The Northman, Mad Max: Fury Road, Tron: Legacy, Dune: Part Two. Listas: Épicas, Visto recientemente, Vibe Mad Max / Tron. Asignados al usuario demo.

```bash
npm run db:seed
```

El seed es idempotente por nombre + año dentro de cada usuario. También crea etiquetas sugeridas (`Épica / guerra`, `Visual / espectáculo`, `Vibe Mad Max`, `Vibe Tron`, etc.).

### Etiquetas (JOR-156)

Cada usuario tiene tags propios (`userId` + `slug` únicos). El unique global de `Tag.name` del init se elimina en la migración `20260903210000_drop_tag_global_name_unique` para que dos cuentas puedan usar el mismo nombre. Al entrar o registrarse, `ensureDefaultTags` siembra las sugeridas. Se pueden crear más desde `/tags` o desde la ficha de un título.

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
| `npm run dev` | Servidor de desarrollo (Node.js, sin cambios) |
| `npm run build` | Build de producción Next.js (Node) |
| `npm run cf:build` | Build OpenNext para Cloudflare Workers |
| `npm run cf:preview` | Build + preview local en runtime Workers (`wrangler dev`) |
| `npm run cf:deploy` | Build + deploy a Cloudflare Workers |
| `npm run cf:upload` | Build + sube versión sin promover |
| `npm run cf:typegen` | Genera tipos TypeScript de bindings Wrangler |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Carga títulos dummy + usuario demo |
| `npm run db:backfill-metadata` | Posters TMDB + rating IMDb para títulos existentes |
| `npm run db:generate` | Regenera el client de Prisma |
| `npm run db:studio` | Prisma Studio |

`postinstall` corre `prisma generate`.

## Despliegue en Cloudflare

Filmia se despliega en **Cloudflare Workers** con `@opennextjs/cloudflare`. Neon Postgres no cambia.

### Prisma en Workers (runtime `cloudflare`)

Cloudflare **workerd** no permite compilar WASM en runtime (`WebAssembly.compileStreaming` / `WebAssembly.Module()` con bytes dinámicos). Prisma 7 con el generador clásico `prisma-client-js` fallaba en login/registro con:

`CompileError: WebAssembly.Module(): Wasm code generation disallowed by embedder`

**Solución aplicada** (ver [guía Prisma + Workers](https://www.prisma.io/docs/guides/deployment/cloudflare-workers)):

1. **`prisma/schema.prisma`**: generador edge con runtime explícito:

   ```prisma
   generator client {
     provider = "prisma-client"
     runtime  = "cloudflare"
     output   = "../src/generated/prisma"
   }
   ```

2. **`src/lib/prisma.ts`**: adaptador Neon serverless + `neonConfig.poolQueryViaFetch = true` (HTTP al pooler; recomendado en Workers). `DATABASE_URL` se recorta, se le quitan comillas envolventes y se valida (`postgresql:` / `postgres:`) **antes** de pasarla al adaptador.

3. **`wrangler.jsonc`**: flag `nodejs_compat` (ya presente) para el stack TCP/Node del adaptador.

4. **OpenNext `@opennextjs/cloudflare` ≥ 1.20.6**: parchea el loader WASM de Next 16.3 (`loadWasmChunk` en lugar de `compileStreaming` en el bundle). Tras `npm run cf:build`, el worker no debe contener llamadas activas a `compileStreaming` en código Prisma.

Regenerar client tras cambiar el schema: `npm run db:generate` (también corre en `postinstall`).

### Requisitos

- Cuenta Cloudflare con Workers habilitado
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (incluido como devDependency)
- URLs Neon del proyecto `filmia` (mismas que local)

### Variables de entorno (Cloudflare)

| Variable | Tipo | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Secreto | URL **pooled** de Neon (runtime Worker) |
| `AUTH_SECRET` | Secreto | JWT Auth.js (`openssl rand -base64 32`) |
| `AUTH_URL` | Variable | URL pública del Worker, p. ej. `https://filmia.<account>.workers.dev` |
| `TMDB_API_KEY` | Secreto | Posters TMDB |
| `OMDB_API_KEY` | Secreto | Ratings IMDb (opcional pero recomendado) |

`DATABASE_URL_UNPOOLED` **no** hace falta en el Worker; solo para migraciones locales/CI.

### Configurar secretos

```bash
npx wrangler login

# Secretos (no aparecen en logs)
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SECRET
npx wrangler secret put TMDB_API_KEY
npx wrangler secret put OMDB_API_KEY

# Variable pública (dashboard Workers → Settings → Variables, o wrangler.jsonc vars)
# AUTH_URL = https://tu-worker.workers.dev
```

Al pegar `DATABASE_URL` en `wrangler secret put`, escribe **solo** la URL (`postgresql://…`) **sin comillas ni saltos de línea**. Un secreto con `"postgresql://…"` o un `\n` final hace que Neon lance `Invalid URL string` y el login falle (Auth.js lo puede enmascarar como credenciales incorrectas).

Para comprobar que el secreto no trae basura (sin imprimirlo):

```bash
npx wrangler secret list
# Confirma que DATABASE_URL existe. Si el login sigue fallando de forma intermitente,
# vuelve a poner el secreto: pega la URL pooled (hostname con -pooler) en una sola línea,
# Enter, y termina con Ctrl+D / EOF — sin comillas alrededor.
```

Para preview local en runtime Workers, copia `.dev.vars.example` → `.dev.vars` y pega tus valores.

### Migraciones (Neon, fuera del Worker)

Prisma migrate no corre dentro de Cloudflare Workers. Desde `sandbox` o local:

```bash
export DATABASE_URL_UNPOOLED="postgresql://..."  # URL directa (sin -pooler)
npx prisma migrate deploy
```

En CI, usa el mismo comando con `DATABASE_URL_UNPOOLED` como secreto del pipeline.

### Desplegar desde `sandbox`

```bash
git checkout sandbox
git pull origin sandbox
npm install
npm run cf:deploy
```

O conecta el repo en Cloudflare Dashboard → Workers → Builds (rama `sandbox`).

### Imágenes (`next/image`)

`wrangler.jsonc` declara el binding `IMAGES` (Cloudflare Images) para optimizar posters TMDB. Los dominios remotos están en `next.config.ts` → `images.remotePatterns`. Si Cloudflare Images no está habilitado en la cuenta, los posters pueden servirse sin optimizar (fallback de Next).

### Caché incremental (opcional)

Para ISR/caché persistente con R2, crea un bucket y añade en `wrangler.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "filmia-cache" }
]
```

Y en `open-next.config.ts` importa `r2IncrementalCache` (ver [docs OpenNext](https://opennext.js.org/cloudflare/caching)).

### Checklist de humo post-deploy

1. **Login** en `/login` con usuario demo o cuenta propia
2. **Registro** en `/registro` (cuenta nueva)
3. **CRUD títulos**: crear, editar, borrar un título
4. **Proveedores MX**: ficha de título muestra dónde ver (flatrate)
5. **Diario / listas / tags / series status / calendario** sin regresiones
6. **Logout** («Salir» en cabecera) y redirección a `/login` en rutas protegidas

### Limitaciones conocidas

- **Edge runtime** no soportado; no uses `export const runtime = "edge"`.
- **Migraciones Prisma**: solo CI/local contra Neon, no en el Worker.
- **Vercel**: `vercel.json` desactiva auto-deploy; Cloudflare es el host principal.
- **Cloudflare Images**: puede tener coste extra según uso; binding `IMAGES` en `wrangler.jsonc`.

## Notas para Taller

- El schema y las migraciones van en `prisma/`. Aplícalas con `DATABASE_URL` / `DATABASE_URL_UNPOOLED` del proyecto Neon `filmia` (`late-cell-10415663`).
- Este agente pudo conectar a Neon vía MCP para humo (migrate + seed). Si la VM no tiene `DATABASE_URL`, no hace falta SQLite: apunta Prisma a Neon y corre `migrate deploy`.
- No hay secretos en el repo. Solo `.env.example` y `.dev.vars.example`.
- Producción: secretos en Cloudflare (`wrangler secret put`). Vercel queda como respaldo opcional desactivado.

Ticket scaffold: [JOR-149](https://linear.app/jorg3l3on/issue/JOR-149/scaffold-next-prismaneon-crud-titulos).
Migración Cloudflare: [JOR-160](https://linear.app/jorg3l3on/issue/JOR-160/deploy-migrar-host-de-vercel-a-cloudflare-opennext).
