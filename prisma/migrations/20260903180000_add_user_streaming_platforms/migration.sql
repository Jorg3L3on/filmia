-- Preferencias de streaming del usuario (claves del enum Platform).
-- Array JSON, p. ej. ["NETFLIX","DISNEY"]. Vacío = sin configurar.
ALTER TABLE "User" ADD COLUMN "streamingPlatforms" JSONB NOT NULL DEFAULT '[]';
