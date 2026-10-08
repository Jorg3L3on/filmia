import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { NightEndsForm } from "@/components/NightEndsForm";
import { ProfileHeaderSkeleton, ProfileBodySkeleton } from "@/components/PageSkeletons";
import { ProfileDiary } from "@/components/ProfileDiary";
import { ProfileAccountCard } from "@/components/profile/ProfileAccountCard";
import { ProfileMarquee } from "@/components/profile/ProfileMarquee";
import { StreamingPlatformPicker } from "@/components/StreamingPlatformPicker";
import { getCurrentUserProfile, getRecentWatchedTitles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil",
} as const;

/** Same `limit` as ProfileDiary so the cached query is shared. */
const DIARY_RECENT_LIMIT = 3;

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-xl lg:max-w-5xl">
      <Suspense
        fallback={
          <div className="space-y-8">
            <ProfileHeaderSkeleton />
            <ProfileBodySkeleton />
          </div>
        }
      >
        <ProfileBody />
      </Suspense>
    </div>
  );
}

const ProfileBody = async () => {
  const [profile, recent] = await Promise.all([
    getCurrentUserProfile(),
    getRecentWatchedTitles(DIARY_RECENT_LIMIT),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      <ProfileMarquee name={profile.name} email={profile.email} posterPath={recent[0]?.posterPath ?? null} />

      <div className="space-y-10 lg:grid lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-start lg:gap-14 lg:space-y-0">
        {/* Tu diario stays exactly as it was; only its surroundings changed. */}
        <ProfileDiary />
        <div className="space-y-9">
          <NightEndsForm value={profile.nightEnds} />
          <StreamingPlatformPicker selected={profile.streamingPlatforms} />
          <ProfileAccountCard
            name={profile.name}
            email={profile.email}
            hasPassword={profile.hasPassword}
            googleLinked={profile.googleLinked}
          />
          <LogoutButton />
        </div>
      </div>
    </div>
  );
};
