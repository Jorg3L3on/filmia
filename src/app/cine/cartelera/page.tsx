import type { CSSProperties } from "react";
import { Suspense } from "react";
import { CineActionsProvider } from "@/components/cine/CineActions";
import { CineMarquee } from "@/components/cine/CineParts";
import { CinePoster, PremiereTag } from "@/components/cine/CinePoster";
import { CineGridSkeleton } from "@/components/cine/CineSkeleton";
import { loadCineActions } from "@/app/cine/cine-data";
import { getNowShowing } from "@/lib/cine";
import { formatShortDay, isPremiereWeek, mxToday } from "@/lib/cine-core";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "En cines",
} as const;

export default function CarteleraPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <CineMarquee title="En cines" subtitle="Por fecha de estreno en México" backHref="/cine" />
      <Suspense fallback={<CineGridSkeleton />}>
        <CarteleraGrid />
      </Suspense>
    </div>
  );
}

const CarteleraGrid = async () => {
  const today = mxToday();
  const [actions, films] = await Promise.all([loadCineActions(), getNowShowing()]);

  return (
    <CineActionsProvider
      existing={actions.existing}
      lists={actions.lists}
      memberships={actions.memberships}
      pinnedTitleId={actions.pinnedTitleId}
    >
      {films.length === 0 ? (
        <p className="text-sm text-fog">La cartelera se actualiza cada mañana.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5 sm:gap-x-4">
          {films.map((film, index) => (
            <li key={film.catalogId} className="min-w-0 stagger-in" style={{ "--stagger": Math.min(index, 14) } as CSSProperties}>
              <CinePoster
                film={film}
                priority={index < 6}
                sizes="(max-width: 640px) 31vw, 180px"
                badge={isPremiereWeek(film.mxReleaseDate, today) ? <PremiereTag /> : null}
                caption={`Desde ${formatShortDay(film.mxReleaseDate)}`}
              />
            </li>
          ))}
        </ul>
      )}
    </CineActionsProvider>
  );
};
