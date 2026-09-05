import { EmptyState } from "@/components/EmptyState";
import { formatUserPlatformsList } from "@/lib/streaming-platforms";
import type { Platform } from "@/generated/prisma/browser";

type MissingStreamingDataNoteProps = {
  count: number;
  appearAnyway?: boolean;
};

export const MissingStreamingDataNote = ({
  count,
  appearAnyway = false,
}: MissingStreamingDataNoteProps) => {
  if (count <= 0) {
    return null;
  }

  const message = appearAnyway
    ? count === 1
      ? "1 título aún no tiene datos de streaming."
      : `${count} títulos aún no tienen datos de streaming.`
    : count === 1
      ? "1 título sin datos de streaming no aparece."
      : `${count} títulos sin datos de streaming no aparecen.`;

  return (
    <p className="text-xs text-mist" role="status">
      {message}
    </p>
  );
};

export const MinePlatformsSetupCta = () => (
  <EmptyState
    variant="generic"
    title="Elige tus plataformas"
    description="Para filtrar por plataforma MX, indica cuáles tienes contratadas. El filtro usa disponibilidad incluida en México (suscripción), no renta ni compra."
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
