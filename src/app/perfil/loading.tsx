import { ProfileBodySkeleton, ProfileHeaderSkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-8 lg:max-w-5xl" aria-busy="true" aria-label="Cargando perfil">
      <ProfileHeaderSkeleton />
      <ProfileBodySkeleton />
    </div>
  );
}
