-- Etiquetas removed: drop the user tags and their title links. DESTRUCTIVE, unlike 0004–0007.
-- Apply AFTER deploying the tag-free code (older builds still query "Tag"/"TitleTag" on most pages).
-- Idempotent: TitleTag first (it references Tag), IF EXISTS so a re-run is a no-op.
DROP TABLE IF EXISTS "TitleTag";--> statement-breakpoint
DROP TABLE IF EXISTS "Tag";
