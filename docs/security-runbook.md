# Runbook de seguridad (FIL-I10)

Pasos que corre Jorge fuera del código: Neon, Vercel y GitHub. El código de la iniciativa
ya está en el PR; esto es lo que no se puede hacer desde el repo.

Orden: **1 → deploy del PR → 2 → 3** (3 se puede hacer en cualquier momento).

## 1. Migración 0012 (antes de desplegar)

Aditiva e idempotente: crea `RateLimit` y añade `User.sessionVersion` (default 0). El build
que corre hoy las ignora, así que se aplica antes del deploy.

```bash
npm run db:migrate
```

Nadie pierde la sesión: los tokens viejos no traen versión y se leen como 0.

## 2. Rol de mínimo privilegio en Neon (FIL-I10-5, M3)

La app se conecta hoy como `neondb_owner` (DDL, crear roles, miembro de `neon_superuser`).

1. Genera una contraseña larga (Neon pide ≥ 60 bits de entropía):
   `openssl rand -base64 32 | tr -d '/+=' | cut -c1-32`
2. Crea el rol **por SQL**, no desde la consola de Neon (los roles de la consola entran en
   `neon_superuser`). Con la URL directa del owner:

   ```bash
   psql "$DATABASE_URL_UNPOOLED" -v app_password="'<contraseña>'" -f docs/sql/filmia-app-role.sql
   ```

   La última consulta debe dar `rolcreaterole`, `rolcreatedb`, `can_create` e
   `in_neon_superuser` en `false`.
3. Arma la URL **pooled** con el rol nuevo:
   `postgresql://filmia_app:<contraseña>@<host>-pooler.<región>.aws.neon.tech/neondb?sslmode=require`
4. En Vercel (Production), cambia `DATABASE_URL` por esa URL y redepliega `main`.
   `DATABASE_URL_UNPOOLED` sigue siendo del owner y solo vive en tu Mac: las migraciones
   (`drizzle-kit migrate`) necesitan DDL.
5. Comprueba con la URL nueva (en un `.env` temporal o exportándola):

   ```bash
   DATABASE_URL="<url filmia_app>" npm run db:verify-role
   ```

   Debe terminar en `✓ DATABASE_URL uses filmia_app`. Después abre la app en producción y
   revisa que Hoy, Buscar y Perfil cargan y que los crons de las 09:00–09:45 UTC dan 200.
6. Protege la rama `main` de Neon: Console → proyecto filmia → Branches → `main` →
   **Set as protected**. (Protegida: no se puede borrar ni resetear, y las IP permitidas se
   aplican si algún día las configuras.)

Volver atrás: poner `DATABASE_URL` de nuevo con `neondb_owner` y redesplegar. El rol puede
quedarse.

## 3. GitHub (FIL-I10-6, L5)

Ya en el repo: `.github/dependabot.yml`, `SECURITY.md` y `permissions: contents: read` en CI.
Falta (en la cuenta de Jorge):

1. **Dependabot alerts y security updates**: Settings → Code security → activa
   *Dependabot alerts* y *Dependabot security updates*. También *Private vulnerability
   reporting* (lo usa `SECURITY.md`).
2. **Proteger `main` y `sandbox`**: exige PR, exige que pase CI, prohíbe force-push y borrado.
   El check se llama `lint · types · tests`. Para cada rama:

   ```bash
   for branch in main sandbox; do
     gh api -X PUT "repos/Jorg3L3on/filmia/branches/$branch/protection" --input - <<'JSON'
   {
     "required_status_checks": { "strict": false, "contexts": ["lint · types · tests"] },
     "enforce_admins": false,
     "required_pull_request_reviews": { "required_approving_review_count": 0 },
     "restrictions": null,
     "allow_force_pushes": false,
     "allow_deletions": false
   }
   JSON
   done
   ```

   `enforce_admins: false` te deja saltarte la regla en una emergencia; los agentes solo
   empujan ramas `jl/…`.
3. Comprueba: `gh api repos/Jorg3L3on/filmia/branches/main/protection --jq '.allow_force_pushes.enabled'`
   debe dar `false`.
