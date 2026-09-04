-- Plataformas de streaming de JustWatch / TMDB (región MX) para el perfil
-- y el diario. Additive: los valores existentes no cambian.
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'PARAMOUNT';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'CRUNCHYROLL';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'VIX';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'PLUTO';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'AMCPLUS';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'CURIOSITY';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'LIONSGATE';
