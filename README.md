# Filmia

App personal para trackear películas y series vistas. UI en español, estética Letterboxd casera. Persistencia real con Prisma + Neon (Postgres).

Single-user / v0: no hay login. Posters vía TMDB + rating IMDb vía OMDb (APIs gratuitas). Sin scrapers.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Prisma 7 + adaptador Neon (`@prisma/adapter-neon`)
- Postgres en Neon (proyecto `filmia`)

## Modelo

- **Title**: película o serie, nota personal 1–10, poster (TMDB), rating IMDb (OMDb), plataforma opcional, notas, fecha vista
- **Tag** + **TitleTag**: categorías libres (épico, sci-fi, etc.)
- **List** + **ListItem**: listas y membresía
- **Platform** (enum): Netflix, Prime, Max, Disney+, Claro

## Requisitos

- Node.js 20+
- Una `DATABASE_URL` de Neon (pooled, hostname con `-pooler`)
- Una `DATABASE_URL_UNPOOLED` (directa, sin `-pooler`) para migraciones
- `TMDB_API_KEY` (gratis) para posters
- `OMDB_API_KEY` (gratis, 1000 req/día) para ratings IMDb

## Arranque local

```bash
cp .env.example .env
# Pega las URLs del proyecto Neon `filmia` (nunca commitees .env)

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

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

### Seed

Datos dummy (no personales): Gladiator, Troy, Athena (2022), The Northman, Mad Max: Fury Road, Tron: Legacy, Dune: Part Two. Listas: Épicas, Visto recientemente, Vibe Mad Max / Tron.

```bash
npm run db:seed
```

El seed es idempotente por nombre + año.

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
| `npm run db:seed` | Carga títulos dummy |
| `npm run db:backfill-metadata` | Posters TMDB + rating IMDb para títulos existentes |
| `npm run db:generate` | Regenera el client de Prisma |
| `npm run db:studio` | Prisma Studio |

`postinstall` corre `prisma generate`.

## Notas para Taller

- El schema y las migraciones van en `prisma/`. Aplícalas con `DATABASE_URL` / `DATABASE_URL_UNPOOLED` del proyecto Neon `filmia` (`late-cell-10415663`).
- Este agente pudo conectar a Neon vía MCP para humo (migrate + seed). Si la VM no tiene `DATABASE_URL`, no hace falta SQLite: apunta Prisma a Neon y corre `migrate deploy`.
- No hay secretos en el repo. Solo `.env.example`.

Ticket: [JOR-149](https://linear.app/jorg3l3on/issue/JOR-149/scaffold-next-prismaneon-crud-titulos).
