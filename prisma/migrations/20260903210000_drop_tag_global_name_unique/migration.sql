-- Tag names are per-user (unique on userId+slug). The init unique on name
-- blocked two users from sharing "Sci-fi" / "Épica / guerra".
DROP INDEX IF EXISTS "Tag_name_key";
