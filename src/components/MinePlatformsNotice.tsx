import { EmptyState } from "@/components/EmptyState";
import { formatUserPlatformsList } from "@/lib/streaming-platforms";
import type { Platform } from "@/generated/prisma/client";

type MissingStreamingDataNoteProps = {
  count: number;
};

export const MissingStreamingDataNote = ({
  count,
}: MissingStreamingDataNoteProps) => {
  if (count <= 0) {
    return null;
  }

  return (
    <p className="text-xs text-mist" role="status">
      {count === 1
        ? "1 título sin datos de streaming no aparece."
        : `${count} títulos sin datos de streaming no aparecen.`}
    </p>
  );
};

export const MinePlatformsSetupCta = () => (
  <EmptyState
    title="Elige tus plataformas"
    description="Para filtrar por “Solo en mis plataformas”, indica cuáles tienes contratadas. El filtro usa disponibilidad incluida en México (suscripción), no renta ni compra."
    actionHref="/perfil"
    actionLabel="Ir a perfil"
  />
);

type MinePlatformsEmptyProps = {
  userPlatforms: readonly Platform[];
  actionHref: string;
  hasTagFilters?: boolean;
};

export const MinePlatformsEmpty = ({
  userPlatforms,
  actionHref,
  hasTagFilters = false,
}: MinePlatformsEmptyProps) => {
  const platforms = formatUserPlatformsList(userPlatforms);

  return (
    <EmptyState
      title="Nada en tus plataformas"
      description={
        hasTagFilters
          ? `Ningún título con esas etiquetas está incluido en ${platforms}. El filtro no cuenta renta ni compra.`
          : `Ningún título está incluido en ${platforms}. El filtro no cuenta renta ni compra.`
      }
      actionHref={actionHref}
      actionLabel="Quitar filtros"
    />
  );
};
