-- Quiero ver «Premiadas»: raw OMDb Awards sentence per title. Additive and idempotent, like 0004/0005.
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "awards" text;
