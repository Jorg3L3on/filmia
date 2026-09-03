# Filmia

App personal para trackear películas y series vistas. UI en español, estética Letterboxd casera. Persistencia real con Prisma + Neon (Postgres). Cada usuario tiene su propio diario, listas y watchlist.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Auth.js v5 (`next-auth`) con credenciales (email + contraseña, JWT)
- Prisma 7 + adaptador Neon (`@prisma/adapter-neon`)
- Postgres en Neon (proyecto `filmia`)

## Modelo

- **User**: cuenta con email, contraseña hasheada (bcrypt), nombre opcional y `streamingPlatforms` (JSON: claves del enum `Platform`)
- **Title**: película o serie del usuario, nota personal 1–10, poster (TMDB), rating IMDb (OMDb), plataforma opcional, notas, fecha vista
- **Tag** + **TitleTag**: categorías libres por usuario (épico, sci-fi, etc.)
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
| `NEXTAUTH_URL` | Opcional en local (`http://localhost:3000`); Vercel lo infiere |

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

`prisma.config.ts` lee `DATABASE_URL_UNPOOLED` de forma lazy (sin `env()`), así `prisma generate` / `postinstall` no exige secretos. Migraciones sí necesitan esa URL. La app Next.js usa `DATABASE_URL` (pooled) vía el adaptador Neon.

### JOR-152 — plataformas de streaming del usuario

Nueva columna `User.streamingPlatforms` (`JSONB NOT NULL DEFAULT '[]'`): array de claves del enum `Platform` (`NETFLIX`, `PRIME`, `MAX`, `DISNEY`, `CLARO`, `APPLE`, `MUBI`).

En Neon (proyecto `filmia`, `late-cell-10415663`):

```bash
npx prisma migrate deploy
```

No hace falta seed ni backfill: prefs vacías son válidas. `/perfil` y «dónde ver» muestran el CTA «Elige tus plataformas».

El filtro de biblioteca (JOR-157) puede leer este JSON y usar `titleAvailableOnUserPlatforms` / `STREAMING_PLATFORM_TMDB` en `src/lib/streaming-platforms.ts`. No se aplica el filtro en este cambio.

### Seed

Datos dummy (no personales): Gladiator, Troy, Athena (2022), The Northman, Mad Max: Fury Road, Tron: Legacy, Dune: Part Two. Listas: Épicas, Visto recientemente, Vibe Mad Max / Tron. Asignados al usuario demo.

```bash
npm run db:seed
```

El seed es idempotente por nombre + año dentro de cada usuario.

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
| `npm run build` | Build de producción |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Carga títulos dummy + usuario demo |
| `npm run db:backfill-metadata` | Posters TMDB + rating IMDb para títulos existentes |
| `npm run db:generate` | Regenera el client de Prisma |
| `npm run db:studio` | Prisma Studio |

`postinstall` corre `prisma generate`.

## Notas para Taller

- El schema y las migraciones van en `prisma/`. Aplícalas con `DATABASE_URL` / `DATABASE_URL_UNPOOLED` del proyecto Neon `filmia` (`late-cell-10415663`).
- Este agente pudo conectar a Neon vía MCP para humo (migrate + seed). Si la VM no tiene `DATABASE_URL`, no hace falta SQLite: apunta Prisma a Neon y corre `migrate deploy`.
- No hay secretos en el repo. Solo `.env.example`.
- Añade `AUTH_SECRET` en Vercel (Settings → Environment Variables) antes de desplegar.

Ticket: [JOR-149](https://linear.app/jorg3l3on/issue/JOR-149/scaffold-next-prismaneon-crud-titulos).
