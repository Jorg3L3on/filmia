# Filmia — Vercel playbook (Fase 4 / JOR-213)

Docs + safe config only. **No deploy prod** from this playbook. **No product feature flags.**
Never put real secrets, connection strings, passwords, or live URLs in the repo — use placeholders.

Parent epic: [JOR-209](https://linear.app/jorg3l3on/issue/JOR-209) (canónico F4). This lote: [JOR-213](https://linear.app/jorg3l3on/issue/JOR-213).

## Current policy (paused on sandbox)

| Concern | State today |
| --- | --- |
| Git auto-deploys (GitHub → Vercel) | **Off** — `vercel.json` disables GitHub / per-branch deploys |
| Preview deployments | **Blocked** — `ignoreCommand` always exits `0` (skip build) as a belt-and-suspenders with Git off |
| Production deploy | **Not shipping** — do not promote / do not flip Git on for `main`/`sandbox` until Jorge decides |
| Migrations | **Outside** `next build` — run `npm run db:migrate` locally or in a dedicated CI job |

Jorge preference while the sandbox workflow is the integration lane: **prod-only deploys when publishing**, and **no preview noise** on PRs/feature branches. Preview stays optional and documented below for a later turn-on — this lote does **not** enable it.

Canonical config file: [`vercel.json`](../vercel.json) at repo root.

## 1. Environment variables checklist (names only)

Set these in **Vercel → Project → Settings → Environment Variables**. Values stay in the dashboard (or a secrets manager) — never commit them.

| Name | Scope (when publishing) | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Production (and Preview **if** enabled later) | Neon **pooled** URL (`…-pooler…`). Runtime only. Placeholder: `postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | **Not** required on the Vercel runtime | Neon **direct** URL for `drizzle-kit migrate` / CLI. Keep local or in a migrate-only secret store. Placeholder: `postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/neondb?sslmode=require` |
| `AUTH_SECRET` | Production (and Preview if enabled) | JWT signing secret. Generate: `openssl rand -base64 32`. Empty placeholder in `.env.example`. |
| `AUTH_URL` | Optional | Public app origin. Local: `http://localhost:3000`. On Vercel often inferred; set if callbacks need a fixed origin. |
| `TMDB_API_KEY` | Production (and Preview if enabled) | Posters / search. Free tier key. |
| `OMDB_API_KEY` | Production (and Preview if enabled) | IMDb ratings via OMDb. Free tier key. |

Compatibility alias (app may accept): `NEXTAUTH_SECRET` → treated like `AUTH_SECRET` where documented in README. Prefer setting `AUTH_SECRET`.

Source of truth for **names** in-repo: [`.env.example`](../.env.example). Copy to `.env` locally; never commit `.env`.

Paste hygiene for `DATABASE_URL`: URL only (`postgresql://…`), no wrapping quotes or newlines. Runtime sanitizes quotes/BOM in `src/lib/database-url.ts`; a bad URL surfaces as infra error, not “wrong password”.

## 2. Migrations outside Next build

`package.json` → `"build": "next build"` — **no** `db:migrate`, **no** `drizzle-kit migrate`, **no** `prebuild` migrate hook.

| Do | Don't |
| --- | --- |
| `npm run db:migrate` locally (or a dedicated CI/job step) **before** promoting a schema change | Put migrate inside `next build` / Vercel Install/Build Command |
| Use `DATABASE_URL_UNPOOLED` (direct) for drizzle-kit | Point migrate at the pooled `-pooler` URL if it flakes |
| Keep the journal under `drizzle/` as source of truth | Re-apply historical Prisma SQL |

```bash
# Local or migrate-only runner — placeholders, not real secrets
export DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/neondb?sslmode=require"
npm run db:migrate
```

GitHub Actions [`ci.yml`](../.github/workflows/ci.yml) runs lint / typecheck / test / verify (+ optional build with placeholder env). It does **not** migrate against Neon. That is intentional: CI stays offline-safe; schema apply stays an explicit human/ops step.

If a future migrate CI job is added, keep it **separate** from the Next build job and never as the Vercel Build Command.

## 3. Preview opcional (enable / disable without shipping prod)

### What “blocked preview” means today

`vercel.json` currently:

1. `"github.enabled": false` — Vercel does not auto-deploy from GitHub events.
2. `"git.deploymentEnabled"` — `"*": false` and `"sandbox": false` — no branch (including `sandbox`) auto-deploys.
3. `"ignoreCommand": "exit 0"` — if a build is still queued somehow, the ignore command **skips** it (`exit 0` = ignore; `exit 1` = proceed). Historical Hobby/GitHub-check friction: a hard BLOCKED deploy failed PR checks; skip/ignore keeps checks green while deploys stay off.

Together this is the **paused** posture: sandbox stays the integration branch in Git; Vercel does not publish preview or prod from it.

### Turn preview **on** later (still without prod)

Only when Jorge explicitly wants PR previews. Suggested steps (do **not** run as part of this lote):

1. In Vercel dashboard, ensure Preview env vars exist (same **names** as Production; Preview may use a Neon branch DB — still never commit secrets).
2. Soften `vercel.json`:
   - Remove or set `"github.enabled": true` **only** if Git integration should drive deploys again.
   - Narrow `git.deploymentEnabled` so feature branches can deploy while production stays gated, **or** drop the blanket `"*": false`.
   - Replace ignore with the historical **prod-only skip of non-production** inverted as needed — classic Filmia solo-prod pattern was:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "if [ \"$VERCEL_ENV\" = \"production\" ]; then exit 1; else exit 0; fi"
}
```

   That pattern **builds production** and **skips preview**. To allow preview and still gate prod, invert the condition (skip when `production`, build when preview) **and** keep Production Git deploy protected in the Vercel project settings (Production Branch + manual promote). Prefer dashboard “Ignored Build Step” + Production Branch over surprising `ignoreCommand` flips.

3. Do **not** flip Production Branch auto-deploy or merge-to-prod as part of enabling preview.

### Keep / restore **prod-only** (Jorge preference when publishing)

When ready to publish Filmia again but still avoid preview spam:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "if [ \"$VERCEL_ENV\" = \"production\" ]; then exit 1; else exit 0; fi"
}
```

- `VERCEL_ENV=production` → `exit 1` → **do not ignore** → build runs.
- Any other env (preview/development) → `exit 0` → skip.

Pair with Vercel Production Branch = the branch you intentionally ship (historically discussed as `main` or `sandbox` — decide explicitly before flipping Git on). Until then, keep the current all-off `vercel.json`.

### Turn everything **off** again

Restore the blocked file checked into this repo (Git off + `ignoreCommand: exit 0`), or set Ignored Build Step to `exit 0` in the dashboard.

## 4. Build / install notes (Node, not Workers)

- Runtime target: **Next.js on Node** (Vercel). Cloudflare Workers / OpenNext path was reverted; do not reintroduce it here.
- Install: default `npm install` / `npm ci`. No migrate in install.
- Build: `npm run build` → `next build` only.
- Images: `next.config.ts` → `images.remotePatterns` for TMDB hosts (see file comments + this playbook link).

## 5. Out of scope (this lote)

- Enabling Vercel preview in the dashboard
- Rotating or pasting real secrets
- Deploy / promote to production
- Product feature flags
- Changing Neon project topology

## Quick checklist before any future publish

1. Env names present in Vercel (Production) — values from secrets store, not git.
2. `npm run db:migrate` applied on the target Neon DB **before** traffic hits new schema.
3. `vercel.json` policy matches intent (all-off / prod-only / preview-on).
4. CI green on the PR into `sandbox`; no prod deploy from the PR itself.
