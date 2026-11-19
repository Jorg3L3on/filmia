import { AffinityChip } from "@/components/affinity/AffinityChip";
import { paraTiMeta } from "@/components/para-ti/ParaTiPoster";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import type { ParaTiTitle } from "@/lib/para-ti/rank";
import { streamingPlatformLogoUrl } from "@/lib/streaming-platforms";

/**
 * Under the shelf, the centred title (FIL-I60-5): name, year, score, runtime, platform, affinity
 * level (no «Para ti» label) and the reason line. Long names clamp to two lines.
 */
export const CenterCard = ({ title, children }: { title: ParaTiTitle; children?: React.ReactNode }) => {
  const logo = title.platform ? streamingPlatformLogoUrl(title.platform) : null;
  return (
    <div className="para-ti-card" key={title.catalogId} data-center-card={title.catalogId}>
      <h2 className="para-ti-card-title">{title.name}</h2>
      <p className="para-ti-card-meta">
        <span>{paraTiMeta(title)}</span>
        {title.imdbRating != null ? (
          <span className="para-ti-score">
            <b>IMDb</b> {title.imdbRating.toFixed(1)}
          </span>
        ) : null}
        {title.rtScore != null ? <span className="para-ti-score">RT {title.rtScore}%</span> : null}
        {title.platform ? (
          <span className="inline-flex items-center gap-1">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- 16 px provider logo from TMDB, like the ficha's chips
              <img src={logo} alt="" width={16} height={16} className="size-4 rounded-[4px]" />
            ) : null}
            {PLATFORM_SERVICE_LABEL[title.platform]}
          </span>
        ) : null}
      </p>
      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
        {title.affinity ? (
          <AffinityChip level={title.affinity.level} label={title.affinity.label} lowConfidence={title.affinity.lowConfidence} />
        ) : null}
        {title.reason ? <span className="para-ti-card-reason">{title.reason}</span> : null}
      </div>
      {children}
    </div>
  );
};
