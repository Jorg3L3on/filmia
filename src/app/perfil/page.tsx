import { Suspense } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { PageHeader } from "@/components/PageHeader";
import { ProfileBodySkeleton } from "@/components/PageSkeletons";
import { ProfileAccountForm } from "@/components/ProfileAccountForm";
import { ProfilePasswordForm } from "@/components/ProfilePasswordForm";
import { StreamingPlatformPicker } from "@/components/StreamingPlatformPicker";
import { getCurrentUserProfile } from "@/lib/queries";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil",
} as const;

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Suspense fallback={<ProfileBodySkeleton />}>
        <ProfileBody />
      </Suspense>
    </div>
  );
}

const ProfileBody = async () => {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    notFound();
  }

  const initial = (profile.name?.trim() || profile.email).slice(0, 1).toUpperCase();

  return (
    <>
      <PageHeader
        title="Perfil"
        actions={
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full bg-well text-sm font-semibold text-paper"
              aria-hidden="true"
            >
              {initial}
            </span>
            <span className="sm:hidden">
              <LogoutButton />
            </span>
          </div>
        }
      />

      <ProfileAccountForm name={profile.name} email={profile.email} />
      <ProfilePasswordForm />
      <StreamingPlatformPicker selected={profile.streamingPlatforms} />
    </>
  );
};
