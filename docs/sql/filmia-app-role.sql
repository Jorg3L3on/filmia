-- FIL-I10-5 (M3): least-privilege role for the app runtime.
-- Run ONCE on the Neon `main` branch as neondb_owner (Neon SQL Editor, or
--   psql "$DATABASE_URL_UNPOOLED" -v app_password="'<password>'" -f docs/sql/filmia-app-role.sql).
-- Create the role here, in SQL: roles created from the Neon Console or API join
-- neon_superuser (CREATEDB, CREATEROLE), which is exactly what we want to avoid.
-- Re-running is safe: every step is idempotent except the password, which it resets.

-- 1. The login role. No inheritance from neon_superuser, no DDL, no role admin.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'filmia_app') THEN
    CREATE ROLE filmia_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;
ALTER ROLE filmia_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- psql substitutes :app_password; in the Neon SQL Editor replace it with '<password>' by hand.
ALTER ROLE filmia_app WITH PASSWORD :app_password;

-- 2. Reach the database and the schema, but never create objects in it.
GRANT CONNECT ON DATABASE neondb TO filmia_app;
GRANT USAGE ON SCHEMA public TO filmia_app;
REVOKE CREATE ON SCHEMA public FROM filmia_app;

-- 3. Row access only (DML) on today's tables and sequences.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO filmia_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO filmia_app;

-- 4. Tables future migrations create (drizzle-kit runs as neondb_owner) get the same grants.
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO filmia_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO filmia_app;

-- 5. Check: expect rolcreaterole/rolcreatedb/rolsuper = false, can_create = false,
--    and no neon_superuser membership.
SELECT r.rolname, r.rolsuper, r.rolcreaterole, r.rolcreatedb,
       has_schema_privilege('filmia_app', 'public', 'CREATE') AS can_create,
       pg_has_role('filmia_app', 'neon_superuser', 'MEMBER') AS in_neon_superuser
FROM pg_roles r WHERE r.rolname = 'filmia_app';
