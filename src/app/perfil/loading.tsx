import { PageHeaderSkeleton, ProfileBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-6" aria-busy="true" aria-label="Cargando perfil">
      <PageHeaderSkeleton withAction />
      <ProfileBodySkeleton />
    </div>
  );
}
