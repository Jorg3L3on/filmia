import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NightEndsForm } from "@/components/NightEndsForm";
import { ProfileHeaderSkeleton, ProfileBodySkeleton } from "@/components/PageSkeletons";
import { ProfileDiary } from "@/components/ProfileDiary";
import { ProfileAccountCard } from "@/components/profile/ProfileAccountCard";
import { ProfileMarquee } from "@/components/profile/ProfileMarquee";
import { ProfileTuFilmia } from "@/components/profile/ProfileTuFilmia";
import { ProfileUniverso } from "@/components/universo/ProfileUniverso";
import { ShimmerBlock } from "@/components/PageSkeletons";
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
    <div className="space-y-7 lg:space-y-10">
      <ProfileMarquee name={profile.name} email={profile.email} posterPath={recent[0]?.posterPath ?? null} />

      {/*
        Propuesta B «Secciones a la vista» (FIL-I25-2): Tu diario, Tu Filmia, Hora de dormir,
        Tus plataformas and Cuenta (Salir is its last row). On the phone one column in that order.
      */}
      <div className="space-y-7 lg:grid lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-start lg:gap-14 lg:space-y-0">
        <div className="space-y-7">
          <ProfileDiary />
          {/* FIL-I26-4: TMDB counts behind it, so it never holds the rest of Perfil. */}
          <Suspense fallback={<ShimmerBlock className="h-64 w-full rounded-3xl" />}>
            <ProfileUniverso />
          </Suspense>
          <ProfileTuFilmia />
        </div>
        <div className="space-y-7">
          <NightEndsForm value={profile.nightEnds} />
          <StreamingPlatformPicker selected={profile.streamingPlatforms} />
          <ProfileAccountCard
            name={profile.name}
            email={profile.email}
            hasPassword={profile.hasPassword}
            googleLinked={profile.googleLinked}
          />
        </div>
      </div>
    </div>
  );
};
