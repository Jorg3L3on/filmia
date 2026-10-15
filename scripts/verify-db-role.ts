/**
 * FIL-I10-5 (M3): checks that DATABASE_URL connects as a least-privilege role.
 * Read-only: it asks Postgres about the current role and never tries DDL.
 *   npm run db:verify-role
 */
import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "../src/lib/database-url";

loadEnv({ path: ".env.local" });
loadEnv();

const main = async () => {
  const sql = neon(resolveDatabaseUrl());

  const [row] = (await sql`
    SELECT current_user AS role,
           r.rolsuper, r.rolcreaterole, r.rolcreatedb,
           has_schema_privilege(current_user, 'public', 'CREATE') AS can_create,
           has_table_privilege(current_user, '"User"', 'SELECT, INSERT, UPDATE, DELETE') AS can_dml,
           EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser')
             AND pg_has_role(current_user, 'neon_superuser', 'MEMBER') AS in_neon_superuser
    FROM pg_roles r WHERE r.rolname = current_user
  `) as Array<Record<string, unknown>>;

  const problems = [
    row?.role !== "filmia_app" && `connects as ${String(row?.role)}, not filmia_app`,
    row?.rolsuper && "is superuser",
    row?.rolcreaterole && "can create roles",
    row?.rolcreatedb && "can create databases",
    row?.can_create && "can create objects in schema public (DDL)",
    row?.in_neon_superuser && "is a member of neon_superuser",
    !row?.can_dml && "cannot read/write \"User\" (the app would break)",
  ].filter(Boolean);

  console.log(JSON.stringify(row, null, 2));
  if (problems.length > 0) {
    console.error(`✗ DATABASE_URL role is not least-privilege: ${problems.join("; ")}`);
    process.exit(1);
  }
  console.log("✓ DATABASE_URL uses filmia_app: DML only, no DDL, no role admin.");
};

void main();
