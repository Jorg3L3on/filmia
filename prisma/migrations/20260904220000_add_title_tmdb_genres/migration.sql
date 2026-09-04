-- Géneros TMDB (es-MX) cacheados en el título para el picker del Diario.
-- Array JSON, p. ej. [{"id":18,"name":"Drama"},{"id":35,"name":"Comedia"}].
ALTER TABLE "Title" ADD COLUMN "tmdbGenres" JSONB NOT NULL DEFAULT '[]';
