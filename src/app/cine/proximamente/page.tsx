import { Suspense } from "react";
import { CineActionsProvider } from "@/components/cine/CineActions";
import { CineMarquee } from "@/components/cine/CineParts";
import { UpcomingTimeline } from "@/components/cine/CineSections";
import { CineGridSkeleton } from "@/components/cine/CineSkeleton";
import { loadCineActions } from "@/app/cine/cine-data";
import { getUpcoming } from "@/lib/cine";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Próximamente",
} as const;

export default function ProximamentePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <CineMarquee title="Próximamente" subtitle="Estrenos en México hasta el 31 de diciembre" backHref="/cine" />
      <Suspense fallback={<CineGridSkeleton />}>
        <Timeline />
      </Suspense>
    </div>
  );
}

const Timeline = async () => {
  const [actions, films] = await Promise.all([loadCineActions(), getUpcoming()]);

  return (
    <CineActionsProvider
      existing={actions.existing}
      lists={actions.lists}
      memberships={actions.memberships}
      pinnedTitleId={actions.pinnedTitleId}
    >
      <UpcomingTimeline films={films} />
    </CineActionsProvider>
  );
};
