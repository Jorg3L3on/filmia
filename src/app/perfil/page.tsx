import { Suspense } from "react";
import { Button } from "@/components/Button";
import { LogoutButton } from "@/components/LogoutButton";
import { NightEndsForm } from "@/components/NightEndsForm";
import { PageHeader } from "@/components/PageHeader";
import { ProfileDiary } from "@/components/ProfileDiary";
import { PageHeaderSkeleton, ProfileBodySkeleton } from "@/components/PageSkeletons";
import { ProfileAccountForm } from "@/components/ProfileAccountForm";
import { ProfileGoogleAccess } from "@/components/ProfileGoogleAccess";
import { ProfilePasswordForm } from "@/components/ProfilePasswordForm";
import { StreamingPlatformPicker } from "@/components/StreamingPlatformPicker";
import { getCurrentUserProfile } from "@/lib/queries";
import { wellClass } from "@/lib/ui";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil",
} as const;

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton withAction />
            <ProfileBodySkeleton />
          </>
        }
      >
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
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-well text-sm font-semibold text-paper"
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

      <div className="space-y-8">
        <ProfileDiary />
        <div className="space-y-5">
          <NightEndsForm value={profile.nightEnds} />
          <StreamingPlatformPicker selected={profile.streamingPlatforms} />
          <section className={`${wellClass} flex flex-wrap items-center justify-between gap-3 p-5`} aria-labelledby="bienvenida-h">
            <div className="space-y-1">
              <h2 id="bienvenida-h" className="text-lg font-semibold text-paper">
                Bienvenida
              </h2>
              <p className="text-sm text-fog">
                Rehaz el recorrido inicial: favorita, lo mejor del año, plataformas y hora de dormir.
              </p>
            </div>
            <Button href="/bienvenida" variant="secondary" size="sm">
              Volver a la bienvenida
            </Button>
          </section>
          <ProfileAccountForm name={profile.name} email={profile.email} />
          {profile.googleLinked ? (
            <ProfileGoogleAccess hasPassword={profile.hasPassword} />
          ) : null}
          {profile.hasPassword ? <ProfilePasswordForm /> : null}
        </div>
      </div>
    </>
  );
};
