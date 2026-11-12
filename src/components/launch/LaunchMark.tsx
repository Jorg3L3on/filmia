/**
 * The launch pose (FIL-43): the canvas, a faint warm glow and the cream F.
 * Pure markup with no hooks, so `scripts/generate-ios-splash.mjs` renders it
 * to static HTML and the iOS startup PNG is this exact frame.
 */
export const LaunchMark = () => (
  <>
    <div className="launch-bg" />
    <div className="launch-glow" />
    <svg className="launch-mark" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <mask id="launch-mark-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <g fill="none" stroke="#fff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 18V84" />
            <path d="M22 18H80" />
            <path d="M22 50H64" />
          </g>
          <g fill="#000">
            <rect x="18" y="30" width="8" height="6" rx="1.5" />
            <rect x="18" y="39" width="8" height="6" rx="1.5" />
            <rect x="18" y="62" width="8" height="6" rx="1.5" />
            <rect x="18" y="71" width="8" height="6" rx="1.5" />
            <rect x="40" y="14" width="6" height="8" rx="1.5" />
            <rect x="52" y="14" width="6" height="8" rx="1.5" />
            <rect x="64" y="14" width="6" height="8" rx="1.5" />
          </g>
        </mask>
      </defs>
      <rect width="100" height="100" fill="#fff4e6" mask="url(#launch-mark-mask)" />
    </svg>
  </>
);
